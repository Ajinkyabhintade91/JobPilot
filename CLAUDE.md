# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

JobPilot is a self-hosted autonomous job-hunting system (single user, everything in Docker on Windows 11). Nightly it crawls job sources, dedupes, embeds, and scores every job against the owner's CV; approved jobs get an AI-tailored CV + cover letter that a human reviews before anything is queued. Phases 0–3 are built (sourcing, scoring, tailoring); the `strong` tier runs via `OPENROUTER_API_KEY`. The automated submission engine is the remaining phase — until it exists, `submission_state='queued'` rows just wait.

## Commands

```powershell
# Worker (Python 3.12, managed by uv — run from workers/)
cd workers
uv run pytest                                        # full suite
uv run pytest jobpilot_worker/tests/test_scoring.py  # one file
uv run pytest jobpilot_worker/tests/test_tasks.py::test_jobspy_empty_queries_is_partial  # one test
uv run python -m jobpilot_worker.cli --help          # CLI mirror of the task API
# If Windows App Control blocks uv-spawned binaries ("os error 4551"), run in-container:
#   docker compose run --rm --no-deps worker sh -c "uv sync --frozen --quiet && python -m pytest -q"

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
curl -X POST http://localhost:8080/tasks/poll-ats    # also: jobspy, jobbank, dedup, extract-profile, embed-jobs, score-jobs, tailor-approved
curl http://localhost:8080/health                    # db + embedding-dim assert
```

After changing worker code: `docker compose build worker && docker compose up -d worker`.

## Architecture

Three deployable pieces around one Postgres (self-hosted Supabase, vendored+trimmed in `supabase/docker/`, everything behind Kong :8000):

1. **Python worker** (`workers/jobpilot_worker/`) — owns ALL pipeline logic. FastAPI task surface (`api.py`) + identical Typer CLI (`cli.py`), both dispatching through the registry in `tasks.py`. Connects directly to Postgres as `postgres` (bypasses RLS; `user_id` columns fill via DEFAULT).
2. **React dashboard** (`dashboard/`) — Vite + React 19 + Mantine 9 + TanStack Query, talks to PostgREST/Realtime via supabase-js with the anon key + a seeded JWT user. Never touches the service-role key. One sanctioned worker call exists: the Application kit's "Generate now" button POSTs to the loopback worker API (CORS allows only localhost:5173) — it works when the browser runs on this machine and silently defers to the nightly run elsewhere.
3. **N8N** (`n8n/workflows/*.json`, exported and versioned) — the nightly scheduler. It only makes HTTP calls to the worker and branches on the returned `pipeline_runs` row; no logic lives in n8n.

Data flow (nightly 01:00): poll-ats → jobbank → jobspy → dedup → embed-jobs → score-jobs → tailor-approved → Telegram digest, with healthchecks.io pings at start/success and an error workflow for failures.

### Tailoring pipeline (Phase 3)

`tailor.py::tailor_approved` picks up to `BATCH_LIMIT` jobs with `status='approved'` and no application row, generates a tailored CV + cover letter via the strong tier (markdown stored in `documents.latex_source`, linked from an `applications` row), and lands them as `submission_state='manual'` — meaning **awaiting human review**. The dashboard's Application kit (in the job drawer) is the review gate: "Approve & queue auto-apply" flips it to `'queued'`; the actual submission engine is a later phase and nothing ever submits without that human approval. The strong tier routes through OpenRouter (`litellm/config.yaml`); the account is free-tier for now — after adding credits, swap the model line for the commented `claude-sonnet-5` one. Free-tier models DO occasionally fabricate (one kit claimed "actively studying .NET Core" out of thin air) — the review gate is load-bearing.

n8n CLI gotcha: `n8n import:workflow` silently sets `active=false` (it already cost one missed nightly run). After ANY import: re-inject the workflow `id` + `settings.errorWorkflow` before importing, then `n8n update:workflow --id=... --active=true`, restart the container, and verify with `n8n export:workflow --all`.

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
- **Profile pipeline** (`profile.py`): CV (storage bucket or local path) → text (`cv_text.py`) → cheap-tier LLM strict-JSON extraction (invention forbidden) → bge-m3 embedding → versioned `profile` row (`is_active`, previous versions deactivated). The table is `profile`, not `user_profiles`.
- **Testing pattern**: DB-touching task tests use a fake psycopg pool (`_FakePool`/`_FakeConn` dispatching on SQL text); HTTP boundaries are monkeypatched — tests never need Docker running.

### Windows / PowerShell 5.1 gotchas

- Scripts target Windows PowerShell 5.1: no `&&`/`||`, and em-dashes in BOM-less `.ps1` files break parsing. Embedded double-quotes in here-string args to native exes get mangled.
- Python tooling is `uv` (pinned python 3.12 via `workers/.python-version`); don't use pip/venv directly.

### Dashboard design system & UI conventions

`dashboard/DESIGN.md` is authoritative (Linear-style dark): #010102 canvas, four-step surface ladder + hairline borders (no drop shadows), lavender `#5e6ad2` as the ONLY accent (brand mark, primary CTA, focus ring), success green `#27a644` as the only semantic chromatic, Inter, 8px buttons / 12px cards / 16px panels, dark-only. Tokens live in `src/theme.ts` (Mantine) and `src/theme.css` (`--jp-*`). Don't reintroduce yellow/orange badges or shadows.

Layout primitives: `.jp-panel` is intentionally padding-free (it wraps the flush DataTable); content panels add `.jp-panel--pad`. Pages are hash-routed (`#/jobs`, `#/insights`, `#/profile`) via `usePage()` in `App.tsx`, and each page renders inside an `ErrorBoundary` keyed by page so one component crash can't blank the app.

UI conventions established in `JobList.tsx` — keep them when extending:

- `useJobs` fetches a 500-row window; the UI paginates/sorts **client-side** over it. `FETCH_LIMIT` in `JobList.tsx` must stay in sync with the `.limit()` in `useJobs.ts`. Pagination *clamps* the page instead of resetting it so Realtime invalidations don't yank the user back to page 1.
- Sorting sinks null/empty values to the bottom in both directions (unscored jobs never lead the list).
- Search is debounced (250ms, `useDebouncedValue`) before it reaches `useJobs` — don't pass raw keystroke state into a query key.
- Every list needs loading (skeletons on mobile, `fetching` on the table), empty, and error states; clickable mobile cards are `<Card component="button">` (keyboard accessible), never bare click-handler divs; placeholder-only inputs get `aria-label`s.
- Mutations are optimistic (see `useUpdateJob`): patch every cached `['jobs']` query, roll back on error.
- `user_profile_settings.search_queries` is a jsonb array of `{role_family, keywords, location}` OBJECTS (see `jobspy_source.py`), not strings — feeding it to a TagsInput crashed the whole app once. Any editor must preserve that shape.
- The Board (`JobBoard.tsx`) maps statuses onto columns; merged columns (interview+oa, the closed group) show a per-card status chip, Inbox is drag-source-only and capped at 25 by score. Insights aggregates page through jobs in 1000-row chunks (max 5) via `useJobStats` — deliberately separate from the list's 500-row window.
- The Application kit UI lives in `jobs/ApplicationKit.tsx` + `hooks/useApplications.ts` (rendered inside `JobDrawer`). Kit documents join through the two FK names (`documents!applications_tailored_cv_id_fkey` etc.); discarding a kit deletes the applications row AND its two documents rows.

Headless-preview quirks (test artifacts, NOT app bugs — don't chase them): Mantine Modal/Drawer transitions never mount because the backgrounded tab throttles `requestAnimationFrame` (screenshots may also time out), and `useMediaQuery` only flips after a reload when the viewport is emulated. Synthetic (untrusted) keyboard events don't drive Mantine controlled inputs or @hello-pangea/dnd keyboard drags — use real preview clicks, or verify the data layer directly. Verify via DOM/computed-style inspection instead of screenshots when in doubt.
