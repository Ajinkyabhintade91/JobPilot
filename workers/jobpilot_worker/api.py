"""FastAPI surface — the N8N <-> worker contract.

POST /tasks/{name} runs a pipeline task synchronously and returns the finished
pipeline_runs row; N8N branches on its "status" field.
"""
import httpx
from fastapi import FastAPI, HTTPException

from . import db, notify
from .config import settings

app = FastAPI(title="jobpilot-worker")


def _embedding_dim_check() -> dict:
    """Assert LiteLLM's embeddings tier returns EMBEDDING_DIM-length vectors.
    Tolerant when LiteLLM is down (reported, not fatal) — but a *wrong
    dimension* is always an error, it would silently poison vector(1024)."""
    s = settings()
    try:
        resp = httpx.post(
            f"{s.litellm_base_url}/v1/embeddings",
            headers={"Authorization": f"Bearer {s.litellm_master_key}"},
            json={"model": "embeddings", "input": "dim check"},
            timeout=60,
        )
        resp.raise_for_status()
        dim = len(resp.json()["data"][0]["embedding"])
    except Exception as exc:
        return {"ok": None, "detail": f"litellm unreachable: {exc}"}
    if dim != s.embedding_dim:
        return {
            "ok": False,
            "detail": f"embedding dim {dim} != EMBEDDING_DIM {s.embedding_dim} — "
            "schema is vector(1024); fix the embeddings model before any scoring runs",
        }
    return {"ok": True, "dim": dim}


@app.get("/health")
def health() -> dict:
    db_ok = db.healthy()
    dim = _embedding_dim_check()
    return {"ok": db_ok and dim["ok"] is not False, "db": db_ok, "embedding_dim_check": dim}


@app.post("/notify/test")
def notify_test() -> dict:
    result = notify.send_telegram("JobPilot online ✅")
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result)
    return result


TASKS: dict[str, object] = {}
# Phase 1 tasks (poll-ats, jobspy, jobbank, dedup) register themselves here
# via jobpilot_worker.tasks — imported at the bottom to avoid circular imports.


@app.post("/tasks/{name}")
def run_task(name: str) -> dict:
    fn = TASKS.get(name)
    if fn is None:
        raise HTTPException(status_code=404, detail=f"unknown task '{name}'; have {sorted(TASKS)}")
    return fn()  # type: ignore[operator]


from . import tasks  # noqa: E402,F401  (registers TASKS entries)
