"""Telegram boundary contract: alerts routinely carry exception text with
< > & (httpx errors quote URLs/HTML), so the message must go out as plain
text — parse_mode=HTML makes Telegram reject exactly the messages that
matter most — and an API rejection must surface as ok:False, not a raise."""
import httpx
import pytest

from jobpilot_worker import notify


@pytest.fixture
def telegram_configured(monkeypatch):
    monkeypatch.setattr(notify.settings(), "telegram_bot_token", "t0k3n")
    monkeypatch.setattr(notify.settings(), "telegram_chat_id", "42")


def test_sends_plain_text_verbatim(monkeypatch, telegram_configured):
    captured = {}

    def fake_post(url, json=None, timeout=None):
        captured.update(json)
        return httpx.Response(200, json={"ok": True}, request=httpx.Request("POST", url))

    monkeypatch.setattr(notify.httpx, "post", fake_post)
    text = 'Error: <ConnectError "https://x.co?a=1&b=2">'
    result = notify.send_telegram(text)

    assert result["ok"] is True
    assert captured["text"] == text
    assert "parse_mode" not in captured


def test_api_rejection_returns_ok_false_instead_of_raising(monkeypatch, telegram_configured):
    def fake_post(url, json=None, timeout=None):
        return httpx.Response(
            400,
            json={"ok": False, "description": "Bad Request: can't parse entities"},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(notify.httpx, "post", fake_post)
    result = notify.send_telegram("whatever")

    assert result["ok"] is False
    assert "error" in result
