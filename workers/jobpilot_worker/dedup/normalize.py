"""Canonicalization used by both Layer-1 (url_hash) and Layer-2 (fuzzy) dedup."""
import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# tracking params stripped from URLs; gh_jid is kept (it identifies the job)
_TRACKING_PARAMS = re.compile(
    r"^(utm_\w+|ref|referer|referrer|source|src|gh_src|lever-origin|"
    r"lever-source(%5B%5D|\[\])?|ashby_src|trk|trackingid|cid|fbclid|gclid)$",
    re.IGNORECASE,
)

_LEGAL_SUFFIXES = re.compile(
    r"\b(inc|ltd|llc|corp|co|technologies|technology|labs|canada|software|group)\b\.?",
    re.IGNORECASE,
)
_PUNCT = re.compile(r"[^\w\s]")
_WS = re.compile(r"\s+")
_BRACKETS = re.compile(r"[\(\[\{][^\)\]\}]*[\)\]\}]")
_REQ_ID = re.compile(r"(\breq\s*[-#]?\s*\d+|#\d+|\br\d{4,})\b", re.IGNORECASE)
_REMOTE = re.compile(r"\b(remote|anywhere|télétravail|teletravail|work from home|wfh)\b", re.IGNORECASE)

_TITLE_REPLACEMENTS = [
    (re.compile(r"\bsr\.?\b", re.IGNORECASE), "senior"),
    (re.compile(r"\bjr\.?\b", re.IGNORECASE), "junior"),
    (re.compile(r"\biii\b", re.IGNORECASE), "3"),
    (re.compile(r"\bii\b", re.IGNORECASE), "2"),
    (re.compile(r"\biv\b", re.IGNORECASE), "4"),
]
# titles where a one-sided hit means "different job" even if tokens overlap
SENIORITY_GUARD = re.compile(r"\b(manager|director|intern|co-?op|vp|head|principal|staff|lead)\b", re.IGNORECASE)


def canonical_url(url: str) -> str:
    parts = urlsplit(url.strip())
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if not _TRACKING_PARAMS.match(k)]
    path = parts.path.rstrip("/")
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path,
                       urlencode(query), ""))


def url_hash(url: str) -> str:
    return hashlib.sha256(canonical_url(url).encode("utf-8")).hexdigest()


def norm_company(name: str) -> str:
    s = _LEGAL_SUFFIXES.sub(" ", name.lower())
    s = _PUNCT.sub(" ", s)
    return _WS.sub(" ", s).strip()


def norm_title(title: str) -> str:
    s = _BRACKETS.sub(" ", title.lower())
    s = _REQ_ID.sub(" ", s)
    for pattern, repl in _TITLE_REPLACEMENTS:
        s = pattern.sub(repl, s)
    s = _PUNCT.sub(" ", s)
    return _WS.sub(" ", s).strip()


def is_remote(location: str | None, title: str = "") -> bool:
    text = f"{location or ''} {title}"
    return bool(_REMOTE.search(text))


def norm_city(location: str | None) -> str:
    """First comma-separated token, lowercased — a pragmatic city key."""
    if not location:
        return ""
    city = location.split(",")[0]
    city = _PUNCT.sub(" ", city.lower())
    return _WS.sub(" ", city).strip()
