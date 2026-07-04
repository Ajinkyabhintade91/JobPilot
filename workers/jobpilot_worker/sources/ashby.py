"""Ashby public job board API (no auth)."""
from datetime import datetime

from .base import NormalizedJob, fetch_json, html_to_text

API = "https://api.ashbyhq.com/posting-api/job-board/{slug}"


def parse(payload: dict, company_id: str | None = None) -> list[NormalizedJob]:
    jobs = []
    for j in payload.get("jobs", []):
        if not j.get("isListed", True):
            continue
        posted = None
        if j.get("publishedAt"):
            posted = datetime.fromisoformat(j["publishedAt"].replace("Z", "+00:00"))
        location = j.get("location", "") or ""
        if j.get("isRemote"):
            location = f"{location} (Remote)".strip()
        jobs.append(NormalizedJob(
            source="ashby",
            external_id=str(j.get("id", "")),
            url=j.get("jobUrl", "") or j.get("applyUrl", ""),
            title=j.get("title", ""),
            company_id=company_id,
            location=location,
            description=html_to_text(j.get("descriptionHtml", "")),
            posted_at=posted,
            raw={"id": j.get("id"), "publishedAt": j.get("publishedAt"),
                 "department": j.get("department"), "isRemote": j.get("isRemote")},
        ))
    return jobs


def fetch(slug: str, company_id: str | None = None) -> list[NormalizedJob]:
    return parse(fetch_json(API.format(slug=slug)), company_id)
