"""ATS slug discovery: given company names, guess slugs and probe the three
public ATS APIs. Writes verified rows to companies_ca.csv format.

Usage (CLI): uv run python -m jobpilot_worker.cli probe-ats seeds/candidates_ca.csv seeds/companies_ca.csv
"""
import csv
import re
import time
from datetime import date
from pathlib import Path

import httpx

from ..config import settings

PROBES = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
    "lever": "https://api.lever.co/v0/postings/{slug}?mode=json",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{slug}",
}


def slug_guesses(name: str) -> list[str]:
    base = re.sub(r"[^\w\s-]", "", name.lower()).strip()
    words = base.split()
    guesses = [
        "".join(words),                # janeapp
        "-".join(words),               # jane-app
    ]
    # drop common trailing words: "Ada Support" -> ada
    if len(words) > 1 and words[-1] in {"labs", "app", "support", "inc", "technologies", "software", "health", "financial"}:
        guesses.append("".join(words[:-1]))
        guesses.append("-".join(words[:-1]))
    seen: list[str] = []
    for g in guesses:
        if g and g not in seen:
            seen.append(g)
    return seen


def probe_slug(ats: str, slug: str) -> int | None:
    """Returns job count if the board exists, else None."""
    try:
        resp = httpx.get(
            PROBES[ats].format(slug=slug),
            headers={"User-Agent": settings().user_agent},
            timeout=10,
            follow_redirects=True,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
    except Exception:
        return None
    if ats == "lever":
        return len(data) if isinstance(data, list) else None
    if isinstance(data, dict) and "jobs" in data:
        return len(data["jobs"])
    return None


def probe_companies(candidates_csv: str | Path, out_csv: str | Path) -> dict:
    hits, misses, ambiguous = [], [], []
    with open(candidates_csv, newline="", encoding="utf-8") as f:
        candidates = list(csv.DictReader(f))

    for cand in candidates:
        name = cand["name"].strip()
        found: list[tuple[str, str, int]] = []
        for slug in slug_guesses(name):
            for ats in PROBES:
                count = probe_slug(ats, slug)
                if count is not None:
                    found.append((ats, slug, count))
                time.sleep(0.5)
            if found:
                break  # first working slug guess wins; more guesses = more ambiguity
        if not found:
            misses.append(name)
            continue
        # prefer the board with the most jobs if one slug hit multiple ATSes
        found.sort(key=lambda x: -x[2])
        ats, slug, count = found[0]
        note = ""
        if len(found) > 1:
            note = f"ambiguous: also {[(a, s) for a, s, _ in found[1:]]}"
            ambiguous.append(name)
        hits.append({
            "name": name, "ats_type": ats, "ats_slug": slug,
            "website": cand.get("website", ""), "hq_city": cand.get("hq_city", ""),
            "verified_at": date.today().isoformat(), "notes": note or f"{count} jobs at probe time",
        })

    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "name", "ats_type", "ats_slug", "website", "hq_city", "verified_at", "notes"])
        writer.writeheader()
        writer.writerows(hits)

    return {"hits": len(hits), "misses": misses, "ambiguous": ambiguous}
