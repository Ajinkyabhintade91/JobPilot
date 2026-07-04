"""Profile extraction: parsing/validation of LLM output (pure, no LLM)."""
import pytest

from jobpilot_worker.profile import parse_profile_json, profile_embedding_text

VALID = """
{
  "full_name": "Ajinkya Bhintade",
  "headline": "Full-stack engineer",
  "years_experience": 6,
  "titles": ["Software Engineer", "Integration Engineer"],
  "skills": ["Python", "TypeScript", "PostgreSQL"],
  "locations": ["Toronto, ON"],
  "languages": ["English"],
  "education": ["BSc Computer Science"],
  "highlights": ["Built a payments platform"]
}
"""


def test_parses_clean_json():
    p = parse_profile_json(VALID)
    assert p["skills"] == ["Python", "TypeScript", "PostgreSQL"]
    assert p["years_experience"] == 6


def test_parses_json_wrapped_in_code_fences_and_prose():
    raw = "Here is the extracted profile:\n```json\n" + VALID + "\n```\nDone."
    assert parse_profile_json(raw)["full_name"] == "Ajinkya Bhintade"


def test_missing_substance_rejected():
    with pytest.raises(ValueError, match="titles or skills"):
        parse_profile_json('{"full_name": "X", "titles": [], "skills": []}')


def test_non_json_rejected():
    with pytest.raises(ValueError):
        parse_profile_json("I could not find a CV in this text.")


def test_scalar_list_items_coerced_to_strings():
    p = parse_profile_json('{"titles": ["Engineer"], "skills": ["Python", 3.11]}')
    assert p["skills"] == ["Python", "3.11"]


def test_embedding_text_contains_signal_fields():
    p = parse_profile_json(VALID)
    text = profile_embedding_text(p)
    for fragment in ("Full-stack engineer", "Integration Engineer", "Python",
                     "Built a payments platform"):
        assert fragment in text
