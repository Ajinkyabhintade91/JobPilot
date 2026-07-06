"""Approved job -> tailored CV + cover letter -> application row awaiting review.

Truthful by construction: the prompt may only reorder, emphasize, and rephrase
facts already in profile_json — inventing experience is forbidden. Submission
NEVER happens here; a generated kit lands as submission_state='manual' and a
human flips it to 'queued' in the dashboard after reviewing it.
"""
import json

from . import llm
from .db import pool
from .runs import pipeline_run

# per-run ceiling: bounds strong-tier spend and keeps the nightly window short
BATCH_LIMIT = 5

KIT_SYSTEM = """You tailor job applications. You are given a candidate profile \
(JSON) and one job posting. Return ONLY a JSON object with exactly these keys:
tailored_cv_markdown (string): the candidate's CV in clean markdown, reordered \
and reworded to emphasize the experience and skills most relevant to THIS job.
cover_letter_markdown (string): a concise cover letter (under 300 words) for \
THIS job, professional and specific, no filler.
matched_strengths (string[]): 3-6 short bullets naming which of the \
candidate's real strengths map to the job's requirements.

HARD RULES - violating any of these makes the output worthless:
- Use ONLY facts present in the profile. NEVER invent employers, job titles,
  dates, degrees, certifications, projects, metrics, or skills.
- Reordering, emphasis, and rephrasing are allowed; fabrication is not.
- If the profile lacks something the job wants, omit it - do not fake it.
- Do not claim years of experience beyond what the profile states."""


def kit_prompt(profile: dict, job: dict) -> str:
    """Pure prompt builder — unit-testable without LLM or DB."""
    description = (job.get("description") or "")[:7000]
    return (
        "CANDIDATE PROFILE (the only source of facts about the candidate):\n"
        f"{json.dumps(profile, indent=1)}\n\n"
        "JOB POSTING:\n"
        f"Title: {job.get('title') or ''}\n"
        f"Company: {job.get('company') or ''}\n"
        f"Location: {job.get('location') or ''}\n"
        f"Description:\n{description}"
    )


def parse_kit_json(raw: str) -> dict:
    """Tolerates code fences / surrounding prose; both documents must exist."""
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end <= start:
        raise ValueError(f"no JSON object in LLM output: {raw[:200]!r}")
    kit = json.loads(raw[start:end + 1])
    if not isinstance(kit, dict):
        raise ValueError("LLM output is not a JSON object")
    for key in ("tailored_cv_markdown", "cover_letter_markdown"):
        if not isinstance(kit.get(key), str) or len(kit[key].strip()) < 100:
            raise ValueError(f"kit is missing a usable {key}")
    strengths = kit.get("matched_strengths") or []
    if not isinstance(strengths, list):
        strengths = [strengths]
    kit["matched_strengths"] = [str(s).strip() for s in strengths if str(s).strip()]
    return kit


def _save_kit(conn, job_id: str, kit: dict) -> str:
    """documents rows hold the markdown in latex_source; applications links them."""
    cv_id = conn.execute(
        """
        INSERT INTO documents (kind, version, latex_source, is_active)
        VALUES ('tailored_cv', 1, %s, true) RETURNING id
        """,
        (kit["tailored_cv_markdown"],),
    ).fetchone()[0]
    letter_id = conn.execute(
        """
        INSERT INTO documents (kind, version, latex_source, is_active)
        VALUES ('cover_letter', 1, %s, true) RETURNING id
        """,
        (kit["cover_letter_markdown"],),
    ).fetchone()[0]
    app_id = conn.execute(
        """
        INSERT INTO applications (job_id, tailored_cv_id, cover_letter_id,
                                  cv_variant, screening_answers, submission_state)
        VALUES (%s, %s, %s, 'ai_tailored', %s::jsonb, 'manual')
        RETURNING id
        """,
        (job_id, cv_id, letter_id,
         json.dumps({"matched_strengths": kit["matched_strengths"]})),
    ).fetchone()[0]
    return str(app_id)


def tailor_approved() -> dict:
    """Task: generate application kits for approved jobs that have none yet."""
    with pipeline_run("tailoring") as run:
        with pool().connection() as conn:
            profile_row = conn.execute(
                "SELECT profile_json FROM profile WHERE is_active "
                "ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
            if profile_row is None:
                raise RuntimeError("no active profile - run extract-profile first")
            profile = profile_row[0]
            jobs = conn.execute(
                """
                SELECT j.id, j.title, j.location, j.description,
                       COALESCE(c.name, j.raw->>'company') AS company
                  FROM jobs j
             LEFT JOIN companies c ON c.id = j.company_id
                 WHERE j.status = 'approved'
                   AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id)
              ORDER BY j.match_score DESC NULLS LAST
                 LIMIT %s
                """,
                (BATCH_LIMIT,),
            ).fetchall()

        run.stats.update(attempted=len(jobs), generated=0)
        for job_id, title, location, description, company in jobs:
            job = {"title": title, "location": location,
                   "description": description, "company": company}
            try:
                raw = llm.chat(kit_prompt(profile, job), system=KIT_SYSTEM,
                               tier="strong", timeout=300.0, max_tokens=6000)
                kit = parse_kit_json(raw)
                with pool().connection() as conn:
                    app_id = _save_kit(conn, str(job_id), kit)
                run.stats["generated"] += 1
                run.stats.setdefault("applications", []).append(app_id)
            except Exception as exc:  # noqa: BLE001 - per-job isolation
                run.add_error(job_id=str(job_id), title=title, error=str(exc))
    return run.result  # type: ignore[attr-defined]
