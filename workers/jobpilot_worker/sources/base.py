"""Shared sourcing plumbing: NormalizedJob, polite fetching, and upsert."""
import json
import time
from dataclasses import dataclass, field
from datetime import datetime

import httpx
from selectolax.parser import HTMLParser
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..config import settings
from ..db import pool
from ..dedup.normalize import is_remote, url_hash


@dataclass
class NormalizedJob:
    source: str            # greenhouse|lever|ashby|indeed|linkedin|glassdoor|jobbank
    url: str
    title: str
    external_id: str = ""
    company_id: str | None = None
    location: str = ""
    description: str = ""
    posted_at: datetime | None = None
    raw: dict = field(default_factory=dict)

    @property
    def remote(self) -> bool:
        return is_remote(self.location, self.title)


class FetchError(Exception):
    pass


@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, FetchError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, max=15),
    reraise=True,
)
def fetch_json(url: str) -> dict | list:
    s = settings()
    resp = httpx.get(url, headers={"User-Agent": s.user_agent}, timeout=s.request_timeout_s)
    if resp.status_code >= 500:
        raise FetchError(f"{resp.status_code} from {url}")
    resp.raise_for_status()
    return resp.json()


def html_to_text(html: str) -> str:
    if not html:
        return ""
    text = HTMLParser(html).text(separator="\n")
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


def polite_pause() -> None:
    time.sleep(settings().inter_company_delay_s)


def upsert_jobs(jobs: list[NormalizedJob]) -> dict:
    """Layer-1 dedup: ON CONFLICT (url_hash). Returns {"inserted": n, "updated": n}.
    Re-seen jobs get last_seen_at refreshed and closed_at cleared (reappearance)."""
    inserted = updated = 0
    with pool().connection() as conn:
        for job in jobs:
            row = conn.execute(
                """
                INSERT INTO jobs (company_id, title, url, url_hash, source, description,
                                  location, remote_type, posted_at, external_id, raw,
                                  status, manual_apply_only)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, 'discovered', %s)
                ON CONFLICT (url_hash) DO UPDATE
                    SET last_seen_at = now(), raw = EXCLUDED.raw, closed_at = NULL
                RETURNING (xmax = 0) AS was_inserted
                """,
                (
                    job.company_id, job.title, job.url, url_hash(job.url), job.source,
                    job.description, job.location,
                    "remote" if job.remote else None,
                    job.posted_at, job.external_id, json.dumps(job.raw, default=str),
                    job.source in ("linkedin", "indeed", "glassdoor"),
                ),
            ).fetchone()
            if row[0]:
                inserted += 1
            else:
                updated += 1
    return {"inserted": inserted, "updated": updated}


def close_missing_jobs(company_id: str, source: str, seen_hashes: list[str]) -> int:
    """Jobs of this company+source no longer in the feed get closed_at (ghost signal)."""
    with pool().connection() as conn:
        cur = conn.execute(
            """
            UPDATE jobs SET closed_at = now()
             WHERE company_id = %s AND source = %s AND closed_at IS NULL
               AND NOT (url_hash = ANY(%s))
            """,
            (company_id, source, seen_hashes),
        )
        return cur.rowcount
