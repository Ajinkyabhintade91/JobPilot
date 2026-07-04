import httpx

from .config import settings


def send_telegram(text: str) -> dict:
    """Plain text only: alerts carry exception messages with < > &, which
    parse_mode=HTML makes Telegram reject — losing exactly the alerts that
    matter. Never raises; callers branch on {"ok": bool}."""
    s = settings()
    if not s.telegram_bot_token or not s.telegram_chat_id:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured"}
    try:
        resp = httpx.post(
            f"https://api.telegram.org/bot{s.telegram_bot_token}/sendMessage",
            json={"chat_id": s.telegram_chat_id, "text": text},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPError as exc:
        detail = exc.response.text[:300] if isinstance(exc, httpx.HTTPStatusError) else str(exc)
        return {"ok": False, "error": f"telegram send failed: {detail}"}
