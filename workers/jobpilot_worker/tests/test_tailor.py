"""Pure-function coverage for the tailoring kit: prompt building and the
strict-JSON parse (both run without LLM or DB)."""
import json

import pytest

from jobpilot_worker.tailor import kit_prompt, parse_kit_json

PROFILE = {"full_name": "Test Person", "skills": ["Python", "React"], "titles": ["Developer"]}
JOB = {"title": "React Developer", "company": "Acme", "location": "Montreal",
       "description": "Build UIs. " * 30}

CV_MD = "# Test Person\n\nDeveloper with Python and React experience. " * 5
LETTER_MD = "Dear Hiring Manager, I am applying for this role because... " * 5


def test_kit_prompt_contains_profile_and_job():
    prompt = kit_prompt(PROFILE, JOB)
    assert "Test Person" in prompt
    assert "React Developer" in prompt
    assert "Acme" in prompt


def test_kit_prompt_truncates_long_descriptions():
    prompt = kit_prompt(PROFILE, {**JOB, "description": "x" * 20000})
    assert len(prompt) < 12000


def test_parse_kit_json_happy_path_with_code_fence():
    raw = "```json\n" + json.dumps({
        "tailored_cv_markdown": CV_MD,
        "cover_letter_markdown": LETTER_MD,
        "matched_strengths": ["React experience", 42, "  "],
    }) + "\n```"
    kit = parse_kit_json(raw)
    assert kit["tailored_cv_markdown"] == CV_MD
    # non-strings coerced, blanks dropped
    assert kit["matched_strengths"] == ["React experience", "42"]


def test_parse_kit_json_rejects_missing_or_stub_documents():
    with pytest.raises(ValueError):
        parse_kit_json(json.dumps({"tailored_cv_markdown": CV_MD}))
    with pytest.raises(ValueError):
        parse_kit_json(json.dumps({
            "tailored_cv_markdown": "too short",
            "cover_letter_markdown": LETTER_MD,
        }))
    with pytest.raises(ValueError):
        parse_kit_json("no json here at all")
