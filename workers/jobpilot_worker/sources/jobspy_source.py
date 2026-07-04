"""JobSpy discovery (read-only): Indeed primary, LinkedIn/Glassdoor best-effort.
Search queries come from user_profile_settings.search_queries:
    [{"role_family": "fullstack", "keywords": "full stack developer", "location": "Canada"}]
"""
from datetime import UTC, datetime

from ..db import pool
from ..runs import pipeline_run
from .base import NormalizedJob, upsert_jobs

PRIMARY_SITES = ["indeed"]
BEST_EFFORT_SITES = ["linkedin", "glassdoor"]


def _scrape(sites: list[str], query: dict, results_wanted: int) -> list[NormalizedJob]:
    # imported lazily: jobspy drags in pandas; keep worker cold-start fast
    from jobspy import scrape_jobs

    df = scrape_jobs(
        site_name=sites,
        search_term=query.get("keywords", ""),
        location=query.get("location", "Canada"),
        results_wanted=results_wanted,
        hours_old=72,
        country_indeed="canada",
    )
    jobs = []
    for _, row in df.iterrows():
        url = row.get("job_url") or ""
        if not url:
            continue
        posted = None
        if row.get("date_posted"):
            try:
                posted = datetime.fromisoformat(str(row["date_posted"])).replace(tzinfo=UTC)
            except ValueError:
                posted = None
        site = str(row.get("site", "")).lower() or "indeed"
        jobs.append(NormalizedJob(
            source=site,
            external_id=str(row.get("id", "")) or url,
            url=url,
            title=str(row.get("title", "") or ""),
            location=str(row.get("location", "") or ""),
            description=str(row.get("description", "") or ""),
            posted_at=posted,
            raw={
                "company": str(row.get("company", "") or ""),
                "role_family": query.get("role_family", ""),
                "is_remote": bool(row.get("is_remote", False)),
                "min_amount": row.get("min_amount"),
                "max_amount": row.get("max_amount"),
            },
        ))
    return jobs


def poll_jobspy() -> dict:
    with pipeline_run("sourcing") as run:
        with pool().connection() as conn:
            row = conn.execute(
                "SELECT search_queries FROM user_profile_settings LIMIT 1"
            ).fetchone()
        queries = row[0] if row and row[0] else []
        run.stats.update(attempted=len(queries) or 1, inserted=0, updated=0)
        if not queries:
            run.add_error(error="user_profile_settings.search_queries is empty — nothing to search")
            return run.result  # type: ignore[attr-defined]

        for query in queries:
            try:
                counts = upsert_jobs(_scrape(PRIMARY_SITES, query, results_wanted=100))
                run.stats["inserted"] += counts["inserted"]
                run.stats["updated"] += counts["updated"]
            except Exception as exc:
                run.add_error(sites="indeed", query=query.get("keywords"), error=str(exc))
            # best-effort scrapers: small quotas, failures logged but never fatal
            for site in BEST_EFFORT_SITES:
                try:
                    counts = upsert_jobs(_scrape([site], query, results_wanted=25))
                    run.stats["inserted"] += counts["inserted"]
                    run.stats["updated"] += counts["updated"]
                except Exception as exc:
                    run.add_error(sites=site, query=query.get("keywords"), error=str(exc))
    return run.result  # type: ignore[attr-defined]
