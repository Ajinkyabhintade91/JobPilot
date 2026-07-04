"""Task-level behavior that doesn't need a live DB: the pool boundary is faked.

Regression: poll_jobspy with empty search_queries must return a graceful
pipeline_runs row, not blow up — `return run.result` inside the pipeline_run()
block evaluates before the context manager sets .result.
"""
import json
from datetime import UTC, datetime


class _FakeCursor:
    def __init__(self, row):
        self._row = row

    def fetchone(self):
        return self._row


class _FakeConn:
    def execute(self, sql, params=None):
        s = " ".join(sql.split()).lower()
        if s.startswith("insert into pipeline_runs"):
            return _FakeCursor(("00000000-0000-0000-0000-000000000001",))
        if s.startswith("update pipeline_runs"):
            status, stats_json, error, run_id = params
            now = datetime.now(UTC)
            return _FakeCursor((run_id, "sourcing", now, now, status,
                                json.loads(stats_json), error))
        if "search_queries" in s:
            return _FakeCursor(([],))
        raise AssertionError(f"unexpected sql in fake: {s}")

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakePool:
    def connection(self):
        return _FakeConn()


def test_poll_jobspy_empty_queries_returns_partial_run(monkeypatch):
    from jobpilot_worker import runs
    from jobpilot_worker.sources import jobspy_source

    monkeypatch.setattr(runs, "pool", lambda: _FakePool())
    monkeypatch.setattr(jobspy_source, "pool", lambda: _FakePool())

    result = jobspy_source.poll_jobspy()  # must not raise

    assert result["status"] == "partial"
    assert result["stats"]["inserted"] == 0
    assert "search_queries" in result["stats"]["errors"][0]["error"]
