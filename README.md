# JobPilot

A **self-hosted, autonomous job-hunting system**. Every night it crawls job
sources, deduplicates what it finds, and stages everything in a private
dashboard you can browse, filter, and tag from a phone. In later phases it
scores every job against your CV, tailors truthful applications, and submits
them — but **only after you approve each one**.

Everything runs on your own machine in Docker. No data leaves your network
except the crawls themselves and optional Telegram notifications.

## Current status

| Phase | Scope | Status |
|---|---|---|
| **0 — Foundations** | Docker stack, Supabase (self-hosted), schema + RLS, LLM routing, notifications | ✅ Built & verified |
| **1 — Sourcing + dashboard** | Nightly crawl (ATS APIs, Indeed/LinkedIn, Job Bank RSS), 2-layer dedup, browse/tag dashboard | ✅ Built & verified (soak test pending) |
| **2 — Profile + scoring** | CV upload → structured profile → embedding match score per job | 🔨 Next |
| 3 — Tailoring | Truthful CV/cover-letter tailoring via LLM | Planned |
| 4 — Approval + submission | Swipe-approval queue, controlled auto-submit with proof | Planned |
| 5+ — Tracking, outreach, analytics | Gmail classification, contact drafts, closed-loop metrics | Planned |

First live crawl: **1,782 jobs** from 49 company boards + aggregators,
cross-source duplicate rate 0.34% (criterion: <2%).

## How sourcing works (where the jobs come from)

Three independent pipelines feed the `jobs` table every night at 01:00:

1. **ATS APIs (source of truth)** — the public JSON APIs of Greenhouse,
   Lever, and Ashby career boards for the companies in
   [`seeds/companies_ca.csv`](seeds/companies_ca.csv). This registry is
   bootstrapped from a starter list of Canadian tech employers
   (`seeds/candidates_ca.csv`) and verified by `probe-ats`; **edit these CSVs
   to target the companies you care about**, then run
   `uv run python -m jobpilot_worker.cli load-companies seeds/companies_ca.csv`.
2. **Aggregators (discovery)** — JobSpy scrapes Indeed (primary) and
   LinkedIn/Glassdoor (best-effort) using the search queries stored in
   `user_profile_settings.search_queries`
   (`[{role_family, keywords, location}]`). **These queries define what the
   aggregator crawl looks for — personalize them.**
3. **Job Bank RSS (optional)** — RSS URLs from jobbank.gc.ca searches, stored
   in `user_profile_settings.jobbank_rss_urls`.

Note: until Phase 2 lands, jobs are **not** filtered or ranked by your CV —
the dashboard shows raw crawled inventory from the sources above.

**Dedup** happens in two layers:
- *Layer 1 (exact):* canonical URL (tracking params stripped) → SHA-256
  `url_hash` unique constraint. Re-seen jobs refresh `last_seen_at`; jobs that
  vanish from a feed get `closed_at` (a ghost-posting signal).
- *Layer 2 (fuzzy, cross-source only):* blocked by normalized company,
  matched by title similarity (`token_sort_ratio ≥ 90`) with seniority/level
  guards and remote-country compatibility. ATS rows win over aggregator rows;
  losers point at the winner via `duplicate_of`. Aggregator jobs with no ATS
  match are flagged `manual_apply_only`.

## Architecture

```
                       ┌─────────────────────────────  Docker Compose  ─────────────────────────────┐
                       │                                                                            │
  01:00 nightly        │   N8N ──POST /tasks/*──► Python worker (FastAPI)                           │
  (N8N schedule) ──────┤                          │  poll-ats / jobbank / jobspy / dedup            │
                       │                          ▼                                                 │
  Telegram digest ◄────┤                     Postgres (Supabase: auth, PostgREST, Realtime,         │
  healthchecks.io ◄────┤                        storage, Studio — behind Kong :8000)                │
                       │                          ▲                                                 │
                       │   LiteLLM :4000 ─────────┘ (tiers: cheap / embeddings / strong)            │
                       │      │        └──► Langfuse :3000 (tracing)                                │
                       │      ▼                                                                     │
                       │   Ollama (qwen2.5:3b, bge-m3 — local, no API keys needed)                  │
                       └────────────────────────────────────────────────────────────────────────────┘
                                                   ▲
  React dashboard (Vite :5173, host) ── supabase-js (anon key + RLS) ── Kong :8000
```

- **Worker** owns all pipeline logic; every task runs inside a
  `pipeline_run()` wrapper that records status/stats/errors to
  `pipeline_runs`, and N8N branches on the returned row.
- **LLM routing**: code only ever names a *tier* (`cheap`, `embeddings`,
  `strong`); [`litellm/config.yaml`](litellm/config.yaml) maps tiers to
  models. Everything currently runs on local Ollama; the `strong` tier
  (Anthropic) activates in Phase 3 by setting `ANTHROPIC_API_KEY`.
- **Embeddings are 1024-dim (bge-m3)** to match `vector(1024)` in the schema.
  The worker `/health` endpoint embeds a probe string and fails loudly on any
  dimension mismatch — swapping in a 768-dim model cannot silently corrupt
  the database.
- **Security posture**: only Kong (:8000) is exposed to the LAN (so a phone
  can use the dashboard); worker, Ollama, LiteLLM, Langfuse, N8N, and
  Postgres are bound to `127.0.0.1`. Every table carries `user_id` + RLS; the
  browser only ever holds the anon key + the seeded user's JWT.

## Bring-up (from scratch)

Prerequisites: Docker Desktop (WSL2 backend), Git, Node LTS,
[uv](https://docs.astral.sh/uv/). Windows-first (PowerShell scripts), but the
stack itself is plain Compose.

```powershell
# 1. secrets — .env is created from .env.example and filled with generated keys
powershell -File scripts/generate-keys.ps1
#    then fill the three <manual> values in .env:
#    TELEGRAM_BOT_TOKEN (from @BotFather), TELEGRAM_CHAT_ID, HC_PING_URL (healthchecks.io)

# 2. stack (first start pulls images; ollama-pull fetches ~3.5 GB of models once)
docker compose up -d
powershell -File scripts/ollama-pull.ps1

# 3. schema + dashboard login user
powershell -File scripts/migrate.ps1         # idempotent, tracks schema_migrations
powershell -File scripts/seed-auth-user.ps1  # GoTrue user with id = JOBPILOT_USER_ID

# 4. seed the company registry and run a first crawl
cd workers
uv run python -m jobpilot_worker.cli load-companies ../seeds/companies_ca.csv
curl -X POST http://localhost:8080/tasks/poll-ats
curl -X POST http://localhost:8080/tasks/jobspy
curl -X POST http://localhost:8080/tasks/dedup

# 5. verify
curl http://localhost:8080/health              # db + embedding-dim check
curl -X POST http://localhost:8080/notify/test # Telegram message arrives

# 6. dashboard
cd ../dashboard && npm install && npm run dev  # login with JOBPILOT_LOGIN_* from .env
```

For the nightly automation: open N8N (http://localhost:5678), create the
owner account, import both workflows from [`n8n/workflows/`](n8n/workflows/),
set `error_handler` as the error workflow of `nightly_crawl`, and activate.

## Service map

| Service | URL | Auth |
|---|---|---|
| Supabase API (Kong) | http://localhost:8000 | anon key / JWT |
| Supabase Studio | http://localhost:8000 | basic auth: `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` |
| Dashboard (dev) | http://localhost:5173 | `JOBPILOT_LOGIN_EMAIL`/`JOBPILOT_LOGIN_PASSWORD` |
| N8N | http://localhost:5678 | owner account (create on first visit) |
| Langfuse | http://localhost:3000 | sign up on first visit |
| LiteLLM | http://localhost:4000 | `LITELLM_MASTER_KEY` |
| Worker API | http://localhost:8080 | none (loopback only) |
| Postgres | localhost:5432 | `postgres`/`POSTGRES_PASSWORD` |

## Layout

```
supabase/docker/      vendored official Supabase self-host compose, trimmed
                      (functions/imgproxy/supavisor removed — see git history
                      for the exact diff-from-upstream)
supabase/migrations/  raw SQL, applied transactionally by scripts/migrate.ps1
workers/              Python worker — FastAPI task surface + Typer CLI
  jobpilot_worker/
    sources/          greenhouse / lever / ashby / jobspy / jobbank pollers
    dedup/            URL canonicalization + fuzzy cross-source resolution
    registry/         ATS slug probing + company CSV loader
    tests/            49 tests: parsers, normalization, dedup fixtures, tasks
dashboard/            Vite + React + Mantine (mobile cards / desktop table)
n8n/workflows/        nightly_crawl + error_handler (exported JSON, versioned)
litellm/config.yaml   model tiers: cheap / embeddings / strong
seeds/                company registry CSVs (candidates + probe-verified)
scripts/              PowerShell: keygen, migrate, seed user, model pull
```

## Design invariants

These hold across all phases:

- **Nothing is submitted without human approval.** Overnight work only
  *stages*; a human triggers every submission.
- **Truthful by construction.** Tailoring may select, reorder, and rephrase
  facts from the profile — it may never invent experience or skills.
- **No LinkedIn scraping or automation of member actions.** LinkedIn data
  arrives via best-effort public search only; outreach is draft-only.
- **Secrets never enter git.** `.env` is generated locally by
  `scripts/generate-keys.ps1` and gitignored; the service-role key never
  reaches the browser.
- **Every table carries `user_id` + RLS** — single-user today,
  multi-tenant-ready by design.

## Development

```powershell
cd workers && uv run pytest          # 49 tests
cd dashboard && npx tsc --noEmit     # typecheck
```

Migrations are append-only: never edit an applied file under
`supabase/migrations/`; add a new numbered one and run `scripts/migrate.ps1`.
