"""poll-ats task: fetch every registered ATS company, upsert, close missing."""
from ..db import pool
from ..dedup.normalize import url_hash
from ..runs import pipeline_run
from . import ashby, greenhouse, lever
from .base import close_missing_jobs, polite_pause, upsert_jobs

FETCHERS = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "ashby": ashby.fetch,
}


def poll_ats() -> dict:
    with pipeline_run("sourcing") as run:
        with pool().connection() as conn:
            companies = conn.execute(
                """
                SELECT id, name, ats_type, ats_slug FROM companies
                 WHERE ats_type = ANY(%s) AND ats_slug IS NOT NULL
                 ORDER BY name
                """,
                (list(FETCHERS),),
            ).fetchall()

        run.stats.update(attempted=len(companies), inserted=0, updated=0, closed=0)
        for company_id, name, ats_type, slug in companies:
            try:
                jobs = FETCHERS[ats_type](slug, str(company_id))
                counts = upsert_jobs(jobs)
                closed = close_missing_jobs(
                    str(company_id), ats_type, [url_hash(j.url) for j in jobs]
                )
                run.stats["inserted"] += counts["inserted"]
                run.stats["updated"] += counts["updated"]
                run.stats["closed"] += closed
                with pool().connection() as conn:
                    conn.execute(
                        "UPDATE companies SET last_polled_at = now() WHERE id = %s",
                        (company_id,),
                    )
            except Exception as exc:
                run.add_error(company=name, ats=ats_type, slug=slug, error=str(exc))
            polite_pause()
    return run.result  # type: ignore[attr-defined]
