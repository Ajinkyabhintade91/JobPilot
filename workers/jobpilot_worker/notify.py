import httpx

from .config import settings


def send_telegram(text: str) -> dict:
    s = settings()
    if not s.telegram_bot_token or not s.telegram_chat_id:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured"}
    resp = httpx.post(
        f"https://api.telegram.org/bot{s.telegram_bot_token}/sendMessage",
        json={"chat_id": s.telegram_chat_id, "text": text, "parse_mode": "HTML"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()
