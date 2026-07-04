"""ATS payload parsing against representative fixture JSON."""
from jobpilot_worker.sources import ashby, greenhouse, lever

GREENHOUSE_PAYLOAD = {
    "jobs": [
        {
            "id": 4285367,
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/4285367",
            "title": "Senior Full Stack Developer",
            "location": {"name": "Toronto, Ontario, Canada"},
            "updated_at": "2026-06-28T14:03:11-04:00",
            "content": "&lt;p&gt;Build &amp;amp; ship features.&lt;/p&gt;",
        },
        {
            "id": 4285368,
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/4285368",
            "title": "ML Engineer",
            "location": {"name": "Remote - Canada"},
            "updated_at": "2026-07-01T09:00:00-04:00",
            "content": "&lt;div&gt;LLM apps&lt;/div&gt;",
        },
    ]
}

LEVER_PAYLOAD = [
    {
        "id": "a1b2c3",
        "text": "Backend Engineer",
        "hostedUrl": "https://jobs.lever.co/acme/a1b2c3",
        "createdAt": 1751300000000,
        "categories": {"location": "Vancouver, BC", "team": "Platform", "commitment": "Full-time"},
        "descriptionPlain": "Own services end to end.",
    }
]

ASHBY_PAYLOAD = {
    "jobs": [
        {
            "id": "x9",
            "title": "Frontend Engineer",
            "jobUrl": "https://jobs.ashbyhq.com/acme/x9",
            "location": "Montreal",
            "isRemote": False,
            "isListed": True,
            "publishedAt": "2026-06-30T12:00:00.000Z",
            "descriptionHtml": "<p>React + TypeScript</p>",
        },
        {
            "id": "x10",
            "title": "Hidden Role",
            "jobUrl": "https://jobs.ashbyhq.com/acme/x10",
            "isListed": False,
        },
    ]
}


def test_greenhouse_parse():
    jobs = greenhouse.parse(GREENHOUSE_PAYLOAD, company_id="c-1")
    assert len(jobs) == 2
    j = jobs[0]
    assert j.source == "greenhouse"
    assert j.external_id == "4285367"
    assert j.title == "Senior Full Stack Developer"
    assert j.location == "Toronto, Ontario, Canada"
    assert j.company_id == "c-1"
    # html-escaped html is unescaped then stripped
    assert j.description == "Build & ship features."
    assert j.posted_at is not None and j.posted_at.year == 2026
    assert jobs[1].remote


def test_lever_parse():
    jobs = lever.parse(LEVER_PAYLOAD, company_id="c-2")
    assert len(jobs) == 1
    j = jobs[0]
    assert j.source == "lever"
    assert j.url.endswith("/a1b2c3")
    assert j.location == "Vancouver, BC"
    assert j.posted_at is not None and j.posted_at.year == 2025 or j.posted_at.year == 2026
    assert j.description.startswith("Own services")


def test_ashby_parse_filters_unlisted():
    jobs = ashby.parse(ASHBY_PAYLOAD, company_id="c-3")
    assert len(jobs) == 1
    j = jobs[0]
    assert j.source == "ashby"
    assert j.title == "Frontend Engineer"
    assert j.description == "React + TypeScript"
    assert not j.remote
