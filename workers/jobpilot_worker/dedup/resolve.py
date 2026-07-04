"""Layer-2 fuzzy cross-source dedup.

Blocks candidates on normalized company, matches titles with
token_set_ratio >= 90 (plus a seniority guard), and resolves winners by
source priority: ATS APIs are source-of-truth, aggregators point at them
via duplicate_of. Aggregator-only rows become manual_apply_only.
"""
from rapidfuzz import fuzz

from ..db import pool
from ..dedup.normalize import SENIORITY_GUARD, norm_city, norm_company, norm_title
from ..runs import pipeline_run

# lower value wins
SOURCE_PRIORITY = {
    "greenhouse": 0, "lever": 0, "ashby": 0, "ats_api": 0,
    "jobbank": 1, "indeed": 2, "glassdoor": 3, "linkedin": 4,
    "jobspy": 2, "crawl4ai": 1, "manual": 0,
}
TITLE_THRESHOLD = 90
COMPANY_THRESHOLD = 95


def _guard_mismatch(title_a: str, title_b: str) -> bool:
    """token_set_ratio is dangerously generous: 'Software Engineer' vs
    'Software Engineering Manager' scores high. Reject when exactly one side
    carries a seniority/track marker the other lacks."""
    a = {m.lower() for m in SENIORITY_GUARD.findall(title_a)}
    b = {m.lower() for m in SENIORITY_GUARD.findall(title_b)}
    return a != b


def titles_match(title_a: str, title_b: str) -> bool:
    na, nb = norm_title(title_a), norm_title(title_b)
    if not na or not nb:
        return False
    if _guard_mismatch(na, nb):
        return False
    return fuzz.token_set_ratio(na, nb) >= TITLE_THRESHOLD


def locations_compatible(loc_a: str, remote_a: bool, loc_b: str, remote_b: bool) -> bool:
    if remote_a or remote_b:
        return True
    ca, cb = norm_city(loc_a), norm_city(loc_b)
    return not ca or not cb or ca == cb


def _company_key(row: dict) -> str:
    return norm_company(row["company_name"] or row["raw_company"] or "")


def run_dedup() -> dict:
    with pipeline_run("sourcing") as run:
        with pool().connection() as conn:
            rows = conn.execute(
                """
                SELECT j.id, j.title, j.location, j.source, j.url,
                       j.remote_type = 'remote' AS is_remote,
                       j.first_seen_at, j.duplicate_of,
                       c.name AS company_name,
                       j.raw->>'company' AS raw_company
                  FROM jobs j
                  LEFT JOIN companies c ON c.id = j.company_id
                 WHERE j.closed_at IS NULL AND j.duplicate_of IS NULL
                """
            ).fetchall()
        cols = ("id", "title", "location", "source", "url", "is_remote",
                "first_seen_at", "duplicate_of", "company_name", "raw_company")
        jobs = [dict(zip(cols, r)) for r in rows]

        # block on normalized company
        blocks: dict[str, list[dict]] = {}
        for job in jobs:
            key = _company_key(job)
            if key:
                blocks.setdefault(key, []).append(job)

        dup_count = 0
        pairs: list[tuple[str, str, str]] = []  # (loser_id, winner_id, loser_url)
        for block in blocks.values():
            if len(block) < 2:
                continue
            block.sort(key=lambda j: (SOURCE_PRIORITY.get(j["source"], 5), j["first_seen_at"]))
            claimed: set[int] = set()
            for i, winner in enumerate(block):
                if i in claimed:
                    continue
                for k in range(i + 1, len(block)):
                    if k in claimed:
                        continue
                    cand = block[k]
                    if not titles_match(winner["title"] or "", cand["title"] or ""):
                        continue
                    if not locations_compatible(
                        winner["location"] or "", bool(winner["is_remote"]),
                        cand["location"] or "", bool(cand["is_remote"]),
                    ):
                        continue
                    claimed.add(k)
                    pairs.append((str(cand["id"]), str(winner["id"]), cand["url"]))

        with pool().connection() as conn:
            for loser_id, winner_id, loser_url in pairs:
                conn.execute(
                    "UPDATE jobs SET duplicate_of = %s WHERE id = %s", (winner_id, loser_id)
                )
                conn.execute(
                    """
                    UPDATE jobs SET alt_urls = array_append(alt_urls, %s)
                     WHERE id = %s AND NOT (%s = ANY(alt_urls))
                    """,
                    (loser_url, winner_id, loser_url),
                )
                dup_count += 1
            # aggregator rows with no ATS match stay apply-by-hand
            cur = conn.execute(
                """
                UPDATE jobs SET manual_apply_only = true
                 WHERE source IN ('linkedin','indeed','glassdoor')
                   AND duplicate_of IS NULL AND manual_apply_only = false
                """
            )
            flagged = cur.rowcount
            total_open = conn.execute(
                "SELECT count(*) FROM jobs WHERE closed_at IS NULL"
            ).fetchone()[0]

        run.stats.update(
            attempted=len(jobs),
            duplicates_marked=dup_count,
            manual_apply_flagged=flagged,
            duplicates_pct=round(100.0 * dup_count / max(total_open, 1), 2),
        )
    return run.result  # type: ignore[attr-defined]
