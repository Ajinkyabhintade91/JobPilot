"""Phase 2 scoring: profile-vs-job embedding similarity blended with
title-keyword fit and posting recency into match_score 0-100.

embed-jobs: fills jobs.embedding for open, non-duplicate jobs (batched).
score-jobs: scores every embedded open job against the active profile.
"""
import json
import re
from datetime import UTC, datetime

from . import llm
from .db import pool
from .runs import pipeline_run

# blend weights: semantic fit dominates; title keywords and freshness nudge
W_SIMILARITY, W_TITLE, W_RECENCY = 0.65, 0.20, 0.15
# raw bge-m3 cosine similarity for related/unrelated text lands roughly in
# [0.35, 0.75]; rescale so the blend uses the meaningful part of the range
SIM_FLOOR, SIM_CEIL = 0.35, 0.75

_TOKEN = re.compile(r"[a-z0-9+#]+")


def _tokens(text: str) -> set[str]:
    return set(_TOKEN.findall(text.lower()))


def title_keyword_hit(title: str, queries: list[dict]) -> float:
    """Best fraction of any configured query's keywords present in the title.
    No queries configured -> neutral 0.5 (don't punish unconfigured setups)."""
    if not queries:
        return 0.5
    title_tokens = _tokens(title)
    best = 0.0
    for q in queries:
        q_tokens = _tokens(q.get("keywords", ""))
        if q_tokens:
            best = max(best, len(q_tokens & title_tokens) / len(q_tokens))
    return best


def recency_factor(days: float | None) -> float:
    if days is None:
        return 0.3
    if days <= 7:
        return 1.0
    if days <= 30:
        return 0.6
    return 0.2


def blend_score(similarity: float, title_hit: float, recency: float) -> tuple[int, dict]:
    sim_scaled = min(max((similarity - SIM_FLOOR) / (SIM_CEIL - SIM_FLOOR), 0.0), 1.0)
    blended = W_SIMILARITY * sim_scaled + W_TITLE * title_hit + W_RECENCY * recency
    score = round(100 * min(max(blended, 0.0), 1.0))
    return score, {
        "similarity": round(similarity, 4),
        "similarity_scaled": round(sim_scaled, 4),
        "title_hit": round(title_hit, 4),
        "recency": recency,
        "weights": {"similarity": W_SIMILARITY, "title": W_TITLE, "recency": W_RECENCY},
    }


def embed_jobs(batch_size: int = 32) -> dict:
    with pipeline_run("scoring") as run:
        total = 0
        while True:
            with pool().connection() as conn:
                rows = conn.execute(
                    """
                    SELECT id, coalesce(title,''), coalesce(location,''),
                           left(coalesce(description,''), 4000)
                      FROM jobs
                     WHERE embedding IS NULL AND closed_at IS NULL
                       AND duplicate_of IS NULL
                     LIMIT %s
                    """,
                    (batch_size,),
                ).fetchall()
            if not rows:
                break
            vectors = llm.embed([f"{t}\n{loc}\n{desc}" for _, t, loc, desc in rows])
            with pool().connection() as conn:
                for (job_id, *_), vec in zip(rows, vectors):
                    conn.execute(
                        "UPDATE jobs SET embedding = %s::vector WHERE id = %s",
                        (json.dumps(vec), job_id),
                    )
            total += len(rows)
        run.stats.update(attempted=total, embedded=total)
    return run.result  # type: ignore[attr-defined]


def score_jobs() -> dict:
    with pipeline_run("scoring") as run:
        with pool().connection() as conn:
            if conn.execute("SELECT 1 FROM profile WHERE is_active LIMIT 1").fetchone() is None:
                raise RuntimeError("no active profile - run extract-profile first")
            queries_row = conn.execute(
                "SELECT search_queries FROM user_profile_settings LIMIT 1"
            ).fetchone()
            queries = (queries_row and queries_row[0]) or []
            rows = conn.execute(
                """
                SELECT j.id, coalesce(j.title,''), j.posted_at, j.first_seen_at,
                       1 - (j.embedding <=> p.embedding) AS similarity
                  FROM jobs j,
                       (SELECT embedding FROM profile WHERE is_active
                         ORDER BY version DESC LIMIT 1) p
                 WHERE j.embedding IS NOT NULL AND j.closed_at IS NULL
                   AND j.duplicate_of IS NULL
                """
            ).fetchall()

        now = datetime.now(UTC)
        scored = []
        for job_id, title, posted_at, first_seen, similarity in rows:
            ref = posted_at or first_seen
            days = (now - ref).days if ref else None
            score, breakdown = blend_score(
                float(similarity), title_keyword_hit(title, queries), recency_factor(days)
            )
            scored.append((score, json.dumps(breakdown), job_id))

        with pool().connection() as conn:
            for score, breakdown, job_id in scored:
                conn.execute(
                    """
                    UPDATE jobs
                       SET match_score = %s, score_breakdown = %s::jsonb,
                           status = CASE WHEN status = 'discovered'
                                         THEN 'scored' ELSE status END
                     WHERE id = %s
                    """,
                    (score, breakdown, job_id),
                )
        run.stats.update(attempted=len(scored), scored=len(scored))
    return run.result  # type: ignore[attr-defined]
