"""Lever public postings API (no auth)."""
from datetime import UTC, datetime

from .base import NormalizedJob, fetch_json

API = "https://api.lever.co/v0/postings/{slug}?mode=json"


def parse(payload: list, company_id: str | None = None) -> list[NormalizedJob]:
    jobs = []
    for j in payload:
        posted = None
        if j.get("createdAt"):
            posted = datetime.fromtimestamp(j["createdAt"] / 1000, tz=UTC)
        categories = j.get("categories") or {}
        jobs.append(NormalizedJob(
            source="lever",
            external_id=str(j.get("id", "")),
            url=j.get("hostedUrl", ""),
            title=j.get("text", ""),
            company_id=company_id,
            location=categories.get("location", "") or "",
            description=j.get("descriptionPlain", "") or "",
            posted_at=posted,
            raw={"id": j.get("id"), "createdAt": j.get("createdAt"),
                 "team": categories.get("team"), "commitment": categories.get("commitment")},
        ))
    return jobs


def fetch(slug: str, company_id: str | None = None) -> list[NormalizedJob]:
    return parse(fetch_json(API.format(slug=slug)), company_id)
