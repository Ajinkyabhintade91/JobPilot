"""CV -> structured profile -> embedding -> versioned profile row.

Truthful by construction: the extraction prompt forbids inventing facts;
everything downstream (scoring, tailoring) works only from profile_json.
"""
import json

from . import llm
from .cv_text import cv_bytes_to_text, cv_to_text
from .db import pool
from .runs import pipeline_run

_LIST_FIELDS = ("titles", "skills", "locations", "languages", "education", "highlights")

_SYSTEM = """You extract structured data from CVs/resumes.
Return ONLY a JSON object with exactly these keys:
full_name (string|null), headline (string|null), years_experience (number|null),
titles (string[]), skills (string[]), locations (string[]), languages (string[]),
education (string[]), highlights (string[]).
Rules: use ONLY facts present in the CV text - never invent or embellish.
titles = job titles held or clearly qualified for. highlights = the most
impressive concrete achievements, one short sentence each, max 8."""


def parse_profile_json(raw: str) -> dict:
    """Tolerates code fences / surrounding prose; validates substance."""
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end <= start:
        raise ValueError(f"no JSON object in LLM output: {raw[:200]!r}")
    profile = json.loads(raw[start:end + 1])
    if not isinstance(profile, dict):
        raise ValueError("LLM output is not a JSON object")
    for key in _LIST_FIELDS:
        items = profile.get(key) or []
        if not isinstance(items, list):
            items = [items]
        profile[key] = [str(x).strip() for x in items if str(x).strip()]
    if not profile["titles"] and not profile["skills"]:
        raise ValueError("profile has no titles or skills - extraction failed")
    return profile


def profile_embedding_text(profile: dict) -> str:
    """The text whose embedding represents 'who this candidate is'."""
    parts = [profile.get("headline") or ""]
    parts.append("Titles: " + ", ".join(profile["titles"]))
    parts.append("Skills: " + ", ".join(profile["skills"]))
    parts.extend(profile["highlights"])
    return "\n".join(p for p in parts if p)


def _cv_from_storage() -> tuple[str, str | None]:
    """Newest active master CV from the documents table + storage API.
    Returns (cv_text, document_id)."""
    import httpx

    from .config import settings

    with pool().connection() as conn:
        row = conn.execute(
            """
            SELECT id, storage_path FROM documents
             WHERE kind LIKE 'master_cv%' AND storage_path IS NOT NULL
               AND COALESCE(is_active, true)
             ORDER BY created_at DESC LIMIT 1
            """
        ).fetchone()
    if row is None:
        raise RuntimeError(
            "no master CV found - upload one (documents row + storage object) "
            "or pass a file path to the CLI: cli extract-profile <path>"
        )
    doc_id, storage_path = str(row[0]), row[1]
    s = settings()
    if not s.service_role_key:
        raise RuntimeError("SERVICE_ROLE_KEY not configured on the worker")
    resp = httpx.get(
        f"{s.supabase_url}/storage/v1/object/{storage_path}",
        headers={"Authorization": f"Bearer {s.service_role_key}",
                 "apikey": s.service_role_key},
        timeout=60,
    )
    resp.raise_for_status()
    return cv_bytes_to_text(resp.content, storage_path), doc_id


def extract_profile(cv_path: str | None = None) -> dict:
    """Task: CV -> profile_json -> embedding -> new active profile version."""
    with pipeline_run("scoring") as run:
        if cv_path:
            cv_text, doc_id = cv_to_text(cv_path), None
        else:
            cv_text, doc_id = _cv_from_storage()
        if len(cv_text.strip()) < 100:
            raise RuntimeError(f"CV text suspiciously short ({len(cv_text)} chars)")

        raw = llm.chat(cv_text[:12000], system=_SYSTEM)
        profile = parse_profile_json(raw)
        vector = llm.embed([profile_embedding_text(profile)])[0]

        with pool().connection() as conn:
            conn.execute("UPDATE profile SET is_active = false WHERE is_active")
            row = conn.execute(
                """
                INSERT INTO profile (profile_json, embedding, version, is_active,
                                     source_document_id)
                VALUES (%s::jsonb, %s::vector,
                        COALESCE((SELECT max(version) FROM profile), 0) + 1,
                        true, %s)
                RETURNING id, version
                """,
                (json.dumps(profile), json.dumps(vector), doc_id),
            ).fetchone()
        run.stats.update(
            attempted=1,
            profile_id=str(row[0]),
            version=row[1],
            titles=profile["titles"],
            skills_count=len(profile["skills"]),
        )
    return run.result  # type: ignore[attr-defined]
