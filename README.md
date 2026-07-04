# JobPilot

Self-hosted autonomous job-hunting system: overnight sourcing → scoring →
tailoring → human swipe-approval → controlled submission → closed-loop
analytics. See the BRD/PRD for the full design. This repo currently implements
**Phase 0 (foundations) + Phase 1 (sourcing + dashboard v0)**.

## Stack

Docker Compose runs everything server-side: self-hosted Supabase (trimmed
official stack: db/kong/auth/rest/realtime/storage/meta/studio), N8N, Ollama,
LiteLLM, Langfuse v2, and the Python worker. The React dashboard runs on the
host in dev.

| Service | URL |
|---|---|
| Supabase API (Kong) | http://localhost:8000 |
| Supabase Studio | http://localhost:8000 (basic auth: `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`) |
| N8N | http://localhost:5678 |
| Langfuse | http://localhost:3000 |
| LiteLLM | http://localhost:4000 |
| Worker API | http://localhost:8080 |
| Dashboard (dev) | http://localhost:5173 |
| Postgres | localhost:5432 |

## Bring-up (from scratch)

```powershell
# 0. prerequisites: Docker Desktop (WSL2), Git, Node LTS, uv
# 1. secrets
powershell -File scripts/generate-keys.ps1     # fills .env
#    then fill the three <manual> values in .env:
#    TELEGRAM_BOT_TOKEN (from @BotFather), TELEGRAM_CHAT_ID, HC_PING_URL

# 2. stack
docker compose up -d db                        # let Postgres init first
docker compose up -d
powershell -File scripts/ollama-pull.ps1       # ~3.5 GB, once

# 3. schema + auth user
powershell -File scripts/migrate.ps1
powershell -File scripts/seed-auth-user.ps1

# 4. verify
curl http://localhost:8080/health              # db + embedding-dim check
curl -X POST http://localhost:8080/notify/test # Telegram message
```

## Layout

```
supabase/docker/      vendored official Supabase compose (trimmed — see git history)
supabase/migrations/  raw SQL, applied by scripts/migrate.ps1 (idempotent)
workers/              Python worker (FastAPI tasks called by N8N + Typer CLI)
dashboard/            Vite + React + Mantine dashboard
n8n/workflows/        exported N8N workflows (versioned)
litellm/config.yaml   model tiers: cheap / embeddings / strong
seeds/                Canadian tech company registry CSVs
scripts/              PowerShell: keygen, migrate, seed user, model pull
```

## Design invariants

- **Nothing is submitted without human approval.** Overnight work stages; the
  human triggers.
- **Truthful by construction**: tailoring may select/reorder/rephrase profile
  JSON, never invent.
- **Embeddings are 1024-dim (bge-m3)** to match `vector(1024)`; the worker
  `/health` endpoint asserts this.
- **Single-user, multi-tenant-ready**: every table carries `user_id` + RLS;
  the dashboard authenticates as a seeded user whose id equals
  `JOBPILOT_USER_ID`; workers connect directly to Postgres and bypass RLS.
