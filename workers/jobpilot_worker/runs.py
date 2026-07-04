"""pipeline_runs lifecycle: every task runs inside pipeline_run() so failures
and stats are always recorded, and N8N can branch on the returned row."""
import json
import traceback
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Iterator

from .db import pool


@dataclass
class RunContext:
    run_id: str
    run_type: str
    stats: dict[str, Any] = field(default_factory=dict)
    errors: list[dict[str, Any]] = field(default_factory=list)

    def add_error(self, **info: Any) -> None:
        self.errors.append(info)


def _finish(run_id: str, status: str, stats: dict, error: str | None) -> dict:
    with pool().connection() as conn:
        row = conn.execute(
            """
            UPDATE pipeline_runs
               SET finished_at = now(), status = %s, stats = %s::jsonb, error = %s
             WHERE id = %s
         RETURNING id, run_type, started_at, finished_at, status, stats, error
            """,
            (status, json.dumps(stats), error, run_id),
        ).fetchone()
    return {
        "id": str(row[0]),
        "run_type": row[1],
        "started_at": row[2].isoformat(),
        "finished_at": row[3].isoformat(),
        "status": row[4],
        "stats": row[5],
        "error": row[6],
    }


@contextmanager
def pipeline_run(run_type: str) -> Iterator[RunContext]:
    """Usage:
        with pipeline_run("sourcing") as run:
            ...populate run.stats, run.add_error(...)...
        run.result holds the finished pipeline_runs row afterwards.

    Status rules: exception -> failed; error rate >= 20% of attempted units
    (stats["attempted"]) -> partial; else success.
    """
    with pool().connection() as conn:
        row = conn.execute(
            """
            INSERT INTO pipeline_runs (run_type, started_at, status)
                 VALUES (%s, now(), 'running')
              RETURNING id
            """,
            (run_type,),
        ).fetchone()
    ctx = RunContext(run_id=str(row[0]), run_type=run_type)
    try:
        yield ctx
    except Exception as exc:
        ctx.stats["errors"] = ctx.errors
        ctx.result = _finish(  # type: ignore[attr-defined]
            ctx.run_id, "failed", ctx.stats, f"{exc}\n{traceback.format_exc()}"
        )
        raise
    ctx.stats["errors"] = ctx.errors
    attempted = ctx.stats.get("attempted", 0)
    status = "success"
    if attempted and len(ctx.errors) / attempted >= 0.2:
        status = "partial"
    ctx.result = _finish(ctx.run_id, status, ctx.stats, None)  # type: ignore[attr-defined]
