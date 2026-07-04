FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Layer-cache dependencies separately from source
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY jobpilot_worker ./jobpilot_worker
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8080
CMD ["uvicorn", "jobpilot_worker.api:app", "--host", "0.0.0.0", "--port", "8080"]
