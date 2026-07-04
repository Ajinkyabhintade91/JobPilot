"""Task registry: maps task names to callables returning the finished
pipeline_runs row. Phase 1 fills these in; Phase 0 ships the registry empty
plus a trivial smoke task used to prove the pipeline_runs plumbing."""
from .api import TASKS
from .runs import pipeline_run


def smoke() -> dict:
    with pipeline_run("smoke") as run:
        run.stats["message"] = "pipeline_runs plumbing OK"
    return run.result  # type: ignore[attr-defined]


TASKS["smoke"] = smoke
