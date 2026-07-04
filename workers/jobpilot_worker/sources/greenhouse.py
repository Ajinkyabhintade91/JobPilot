"""Greenhouse public job board API (no auth)."""
import html as html_lib
from datetime import datetime

from .base import NormalizedJob, fetch_json, html_to_text

API = "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"


def parse(payload: dict, company_id: str | None = None) -> list[NormalizedJob]:
    jobs = []
    for j in payload.get("jobs", []):
        posted = None
        if j.get("updated_at"):
            posted = datetime.fromisoformat(j["updated_at"])
        jobs.append(NormalizedJob(
            source="greenhouse",
            external_id=str(j.get("id", "")),
            url=j.get("absolute_url", ""),
            title=j.get("title", ""),
            company_id=company_id,
            location=(j.get("location") or {}).get("name", ""),
            # content is HTML-escaped HTML: unescape then strip
            description=html_to_text(html_lib.unescape(j.get("content", ""))),
            posted_at=posted,
            raw={"id": j.get("id"), "updated_at": j.get("updated_at")},
        ))
    return jobs


def fetch(slug: str, company_id: str | None = None) -> list[NormalizedJob]:
    return parse(fetch_json(API.format(slug=slug)), company_id)
