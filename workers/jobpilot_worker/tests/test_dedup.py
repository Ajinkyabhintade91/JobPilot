"""The 30-pair fixture: known duplicates and known non-duplicates.
This is where the <2% visible-duplicates exit criterion is won or lost."""
import pytest

from jobpilot_worker.dedup.resolve import locations_compatible, titles_match

# (title_a, title_b, should_match)
TITLE_PAIRS = [
    # --- duplicates: formatting / seniority spelling / req-ids / brackets ---
    ("Sr. Software Engineer, Backend", "Senior Software Engineer - Backend", True),
    ("Senior Full Stack Developer (Remote)", "Senior Full Stack Developer", True),
    ("Software Engineer II", "Software Engineer 2", True),
    ("Backend Engineer #4521", "Backend Engineer", True),
    ("Full-Stack Developer", "Full Stack Developer", True),
    ("Sr Software Developer", "Senior Software Developer", True),
    ("Machine Learning Engineer [Toronto]", "Machine Learning Engineer", True),
    ("Software Engineer, Payments", "Payments Software Engineer", True),
    ("Développeur Full Stack (Télétravail)", "Développeur Full Stack", True),
    ("DevOps Engineer (REQ-1234)", "DevOps Engineer", True),
    ("Front End Engineer", "Front-End Engineer", True),
    ("Data Engineer III", "Data Engineer 3", True),
    # --- non-duplicates: different role, track, or seniority marker ---
    ("Software Engineer", "Software Engineering Manager", False),
    ("Senior Software Engineer", "Engineering Director", False),
    ("Software Engineer", "Software Engineer Intern", False),
    ("Backend Engineer", "Frontend Engineer", False),
    ("Data Engineer", "Data Scientist", False),
    ("Machine Learning Engineer", "Machine Learning Intern", False),
    ("Software Engineer", "Staff Software Engineer", False),
    ("Product Manager", "Product Designer", False),
    ("Software Developer", "Lead Software Developer", False),
    ("QA Engineer", "QA Engineering Co-op", False),
    ("Engineering Manager, Platform", "Platform Engineer", False),
    ("VP Engineering", "Software Engineer", False),
    ("Full Stack Developer", "Principal Full Stack Developer", False),
    ("iOS Developer", "Android Developer", False),
]

LOCATION_CASES = [
    # (loc_a, remote_a, loc_b, remote_b, compatible)
    ("Toronto, ON", False, "Toronto, Ontario, Canada", False, True),
    ("Toronto, ON", False, "Vancouver, BC", False, False),
    ("Toronto, ON", False, "Remote - Canada", True, True),
    ("", False, "Montreal, QC", False, True),          # missing location never blocks
    ("Montréal, QC", False, "Montréal", False, True),
]


@pytest.mark.parametrize("a,b,expected", TITLE_PAIRS)
def test_title_pairs(a, b, expected):
    assert titles_match(a, b) is expected, f"{a!r} vs {b!r} expected {expected}"


@pytest.mark.parametrize("la,ra,lb,rb,expected", LOCATION_CASES)
def test_location_compat(la, ra, lb, rb, expected):
    assert locations_compatible(la, ra, lb, rb) is expected
