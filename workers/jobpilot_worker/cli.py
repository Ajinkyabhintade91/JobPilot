"""Typer mirror of the HTTP task surface, for manual/dev runs:
    uv run python -m jobpilot_worker.cli task smoke
    uv run python -m jobpilot_worker.cli notify-test
"""
import json

import typer

app = typer.Typer(no_args_is_help=True)


@app.command()
def task(name: str) -> None:
    from .api import TASKS

    fn = TASKS.get(name)
    if fn is None:
        raise typer.BadParameter(f"unknown task '{name}'; have {sorted(TASKS)}")
    typer.echo(json.dumps(fn(), indent=2, default=str))  # type: ignore[operator]


@app.command()
def notify_test() -> None:
    from . import notify

    typer.echo(json.dumps(notify.send_telegram("JobPilot CLI test ✅"), indent=2))


@app.command()
def probe_ats(candidates_csv: str, out_csv: str) -> None:
    from .registry.probe import probe_companies

    typer.echo(json.dumps(probe_companies(candidates_csv, out_csv), indent=2))


@app.command()
def load_companies(csv_path: str) -> None:
    from .registry.loader import load_companies as _load

    typer.echo(json.dumps(_load(csv_path), indent=2))


if __name__ == "__main__":
    app()
