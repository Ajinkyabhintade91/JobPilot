# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

JobPilot is a self-hosted autonomous job-hunting system (single user, everything in Docker on Windows 11). Nightly it crawls job sources, dedupes, embeds, and scores every job against the owner's CV; later phases add tailoring and human-approved submission. Phases 0–2 are built; Phase 3 (LLM tailoring) is next and activates the `strong` tier via `ANTHROPIC_API_KEY`.

## Commands

```powershell
# Worker (Python 3.12, managed by uv — run from workers/)
cd workers
uv run pytest                                        # full suite
uv run pytest jobpilot_worker/tests/test_scoring.py  # one file
uv run pytest jobpilot_worker/tests/test_tasks.py::test_jobspy_empty_queries_is_partial  # one test
uv run python -m jobpilot_worker.cli --help          # CLI mirror of the task API

# Dashboard (from dashboard/)
npm run dev          # Vite on :5173
npx tsc -b           # typecheck (build runs this too)
npm run lint         # oxlint

# Stack
docker compose up -d
powershell -File scripts/migrate.ps1          # applies supabase/migrations/*.sql, idempotent
powershell -File scripts/generate-keys.ps1    # the ONLY source of .env secrets
powershell -File scripts/seed-auth-user.ps1   # GoTrue login user (id = JOBPILOT_USER_ID)

# Trigger pipeline tasks manually (worker API, loopback only)
curl -X POST http://localhost:8080/tasks/poll-ats    # also: jobspy, jobbank, dedup, extract-profile, embed-jobs, score-jobs
curl http://localhost:8080/health                    # db + embedding-dim assert
```

After changing worker code: `docker compose build worker && docker compose up -d worker`.

## Architecture

Three deployable pieces around one Postgres (self-hosted Supabase, vendored+trimmed in `supabase/docker/`, everything behind Kong :8000):

1. **Python worker** (`workers/jobpilot_worker/`) — owns ALL pipeline logic. FastAPI task surface (`api.py`) + identical Typer CLI (`cli.py`), both dispatching through the registry in `tasks.py`. Connects directly to Postgres as `postgres` (bypasses RLS; `user_id` columns fill via DEFAULT).
2. **React dashboard** (`dashboard/`) — Vite + React 19 + Mantine 9 + TanStack Query, talks to PostgREST/Realtime via supabase-js with the anon key + a seeded JWT user. Never touches the worker or service-role key.
3. **N8N** (`n8n/workflows/*.json`, exported and versioned) — the nightly scheduler. It only makes HTTP calls to the worker and branches on the returned `pipeline_runs` row; no logic lives in n8n.

Data flow (nightly 01:00): poll-ats → jobbank → jobspy → dedup → embed-jobs → score-jobs → Telegram digest, with healthchecks.io pings at start/success and an error workflow for failures.

### Invariants that are easy to break

- **`pipeline_run()` contextmanager** (`runs.py`): `run.result` exists only AFTER the `with` block exits. Never `return run.result` inside the block (this was a real bug — see `test_tasks.py`). Set `run.stats` / call `run.add_error()` inside; return after.
- **Embeddings are 1024-dim (bge-m3)** to match `vector(1024)` in the schema. `/health` embeds a probe string and fails loudly on mismatch. `llm.py::embed` raises on wrong dimension — keep that check.
- **LLM tier routing**: code names only tiers (`cheap` / `embeddings` / `strong`), never models. `litellm/config.yaml` maps tiers to models.
- **Migrations are append-only.** Never edit an applied file in `supabase/migrations/`; add the next numbered file and run `scripts/migrate.ps1` (applies each file in a single transaction).
- **n8n expressions**: `$json` is the *immediate upstream* node only. Reference distant nodes explicitly — `$('Dedup').item.json.stats...` — otherwise expressions silently break when nodes are inserted (this was a real bug).
- **Telegram (`notify.py`) never raises and sends plain text** (no parse_mode — alert bodies contain `< > &`). It returns `{"ok": False, "error": ...}` on failure.
- **Security posture**: only Kong (8000/8443) binds to the LAN; every other service port is prefixed `127.0.0.1:` in the compose files. `SERVICE_ROLE_KEY` is worker-side only. The `.env` is generated, gitignored, and must never be committed; the repo is PUBLIC. Personal data (CVs: `*.docx`/`*.pdf`, gitignored) and personal email addresses stay out of tracked files — contact info goes in `.env` (`USER_AGENT`, `JOBPILOT_LOGIN_EMAIL`).
- **Product invariants (BRD)**: nothing is ever submitted without a human trigger; tailoring may never invent experience ("truthful by construction"); no LinkedIn scraping or automation of member actions; synthetic test data must be wiped from real tables after verification.

### Domain specifics

- **Dedup is two-layer** (`dedup/`): Layer 1 exact — canonical URL → `url_hash` unique constraint (re-seen jobs bump `last_seen_at`, vanished jobs get `closed_at`). Layer 2 fuzzy, cross-source only — blocked by normalized company, `token_sort_ratio ≥ 90` on title with seniority guards; ATS rows beat aggregator rows; losers get `duplicate_of`, unmatched aggregator rows get `manual_apply_only`.
- **Scoring** (`scoring.py`): `0.65·similarity + 0.20·title-keyword-fit + 0.15·recency`, with raw cosine similarity rescaled from [0.35, 0.75] to [0, 1]. Title fit reads `user_profile_settings.search_queries`; changing those queries changes scores.
- **Profile pipeline** (`profile.py`): CV (storage bucket or local path) → text (`cv_text.py`) → cheap-tier LLM strict-JSON extraction (invention forbidden) → bge-m3 embedding → versioned `user_profiles` row (`is_active`, previous versions deactivated).
- **Testing pattern**: DB-touching task tests use a fake psycopg pool (`_FakePool`/`_FakeConn` dispatching on SQL text); HTTP boundaries are monkeypatched — tests never need Docker running.

### Windows / PowerShell 5.1 gotchas

- Scripts target Windows PowerShell 5.1: no `&&`/`||`, and em-dashes in BOM-less `.ps1` files break parsing. Embedded double-quotes in here-string args to native exes get mangled.
- Python tooling is `uv` (pinned python 3.12 via `workers/.python-version`); don't use pip/venv directly.

### Dashboard design system

`dashboard/DESIGN.md` is authoritative (Linear-style dark): #010102 canvas, four-step surface ladder + hairline borders (no drop shadows), lavender `#5e6ad2` as the ONLY accent (brand mark, primary CTA, focus ring), success green `#27a644` as the only semantic chromatic, Inter, 8px buttons / 12px cards / 16px panels, dark-only. Tokens live in `src/theme.ts` (Mantine) and `src/theme.css` (`--jp-*`). Don't reintroduce yellow/orange badges or shadows.
