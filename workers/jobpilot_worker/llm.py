"""LiteLLM client. Pipeline code names a TIER ("cheap"/"embeddings"/"strong");
litellm/config.yaml maps tiers to actual models — never name a model here."""
import httpx

from .config import settings


def _post(path: str, payload: dict, timeout: float) -> dict:
    s = settings()
    resp = httpx.post(
        f"{s.litellm_base_url}{path}",
        headers={"Authorization": f"Bearer {s.litellm_master_key}"},
        json=payload,
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


def chat(prompt: str, *, system: str = "", tier: str = "cheap",
         timeout: float = 600.0, max_tokens: int | None = None) -> str:
    """timeout is generous by default: the cheap tier is a 3B model on CPU.
    Set max_tokens on metered tiers — providers estimate cost from it."""
    messages = ([{"role": "system", "content": system}] if system else [])
    messages.append({"role": "user", "content": prompt})
    payload: dict = {"model": tier, "messages": messages, "temperature": 0}
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    data = _post("/v1/chat/completions", payload, timeout)
    return data["choices"][0]["message"]["content"]


def embed(texts: list[str], *, timeout: float = 300.0) -> list[list[float]]:
    """Embeds via the embeddings tier; enforces EMBEDDING_DIM so a model swap
    can never silently poison vector(1024) columns."""
    if not texts:
        return []
    data = _post("/v1/embeddings", {"model": "embeddings", "input": texts}, timeout)
    vectors = [e["embedding"] for e in sorted(data["data"], key=lambda e: e["index"])]
    expected = settings().embedding_dim
    for v in vectors:
        if len(v) != expected:
            raise ValueError(f"embedding dim {len(v)} != EMBEDDING_DIM {expected}")
    return vectors
