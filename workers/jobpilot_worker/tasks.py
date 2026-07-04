"""Task registry: maps task names to callables returning the finished
pipeline_runs row (N8N branches on its "status")."""
from .api import TASKS
from .dedup.resolve import run_dedup
from .profile import extract_profile
from .runs import pipeline_run
from .sources.ats import poll_ats
from .sources.jobbank import poll_jobbank


def smoke() -> dict:
    with pipeline_run("smoke") as run:
        run.stats["message"] = "pipeline_runs plumbing OK"
    return run.result  # type: ignore[attr-defined]


def _poll_jobspy() -> dict:
    # lazy import: jobspy pulls pandas; don't pay that on worker startup
    from .sources.jobspy_source import poll_jobspy

    return poll_jobspy()


TASKS["smoke"] = smoke
TASKS["poll-ats"] = poll_ats
TASKS["jobbank"] = poll_jobbank
TASKS["jobspy"] = _poll_jobspy
TASKS["dedup"] = run_dedup
TASKS["extract-profile"] = extract_profile
