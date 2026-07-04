"""Job Bank Canada RSS discovery. Feed URLs are stored per-user in
user_profile_settings.jobbank_rss_urls (built from jobbank.gc.ca search pages)."""
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import feedparser

from ..db import pool
from ..runs import pipeline_run
from .base import NormalizedJob, upsert_jobs


def _parse_feed(url: str) -> list[NormalizedJob]:
    feed = feedparser.parse(url)
    jobs = []
    for entry in feed.entries:
        posted = None
        if entry.get("published"):
            try:
                posted = parsedate_to_datetime(entry["published"])
            except (TypeError, ValueError):
                try:
                    posted = datetime.fromisoformat(entry["published"]).replace(tzinfo=UTC)
                except ValueError:
                    posted = None
        jobs.append(NormalizedJob(
            source="jobbank",
            external_id=entry.get("id", "") or entry.get("link", ""),
            url=entry.get("link", ""),
            title=entry.get("title", ""),
            location=entry.get("summary", "")[:120],
            description=entry.get("summary", ""),
            posted_at=posted,
            raw={"feed": url},
        ))
    return jobs


def poll_jobbank() -> dict:
    with pipeline_run("sourcing") as run:
        with pool().connection() as conn:
            row = conn.execute(
                "SELECT jobbank_rss_urls FROM user_profile_settings LIMIT 1"
            ).fetchone()
        urls = row[0] if row and row[0] else []
        run.stats.update(attempted=len(urls), inserted=0, updated=0, feeds=len(urls))
        for url in urls:
            try:
                counts = upsert_jobs(_parse_feed(url))
                run.stats["inserted"] += counts["inserted"]
                run.stats["updated"] += counts["updated"]
            except Exception as exc:
                run.add_error(feed=url, error=str(exc))
    return run.result  # type: ignore[attr-defined]
