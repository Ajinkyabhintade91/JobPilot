from jobpilot_worker.dedup.normalize import (
    canonical_url,
    is_remote,
    norm_city,
    norm_company,
    norm_title,
    url_hash,
)


def test_canonical_url_strips_tracking_keeps_gh_jid():
    a = canonical_url("https://boards.greenhouse.io/shopify/jobs/123?gh_jid=123&gh_src=abc&utm_source=li")
    assert a == "https://boards.greenhouse.io/shopify/jobs/123?gh_jid=123"


def test_canonical_url_case_and_trailing_slash():
    assert canonical_url("HTTPS://Jobs.Lever.CO/wealthsimple/abc/") == \
        canonical_url("https://jobs.lever.co/wealthsimple/abc")


def test_url_hash_stable():
    assert url_hash("https://x.co/a?utm_source=1") == url_hash("https://x.co/a")


def test_norm_company_legal_suffixes():
    assert norm_company("Shopify Inc.") == "shopify"
    assert norm_company("Jane Software Inc") == "jane"
    assert norm_company("1Password") == norm_company("1password")


def test_norm_title():
    assert norm_title("Sr. Software Engineer, Backend (Remote)") == "senior software engineer backend"
    assert norm_title("Software Engineer II - Platform #4521") == "software engineer 2 platform"


def test_remote_detection():
    assert is_remote("Remote - Canada")
    assert is_remote(None, "Backend Dev (Télétravail)")
    assert not is_remote("Toronto, ON")


def test_norm_city():
    assert norm_city("Toronto, ON, Canada") == "toronto"
    assert norm_city("Montréal, QC") == "montréal"
    assert norm_city(None) == ""
