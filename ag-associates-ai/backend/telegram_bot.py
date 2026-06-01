"""Telegram bot service for OTP notifications to offline staff.

Pattern follows voice/whatsapp.py — thin HTTP wrapper around the Bot API.
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")

API_BASE = "https://api.telegram.org/bot"


def _bot_url(method: str) -> str:
    return f"{API_BASE}{TELEGRAM_BOT_TOKEN}/{method}"


def configured() -> bool:
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)


def send_message(text: str, chat_id: Optional[str] = None) -> bool:
    """Send a message to the configured Telegram chat."""
    if not configured():
        logger.warning("Telegram not configured — message skipped")
        return False
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(_bot_url("sendMessage"), json={
                "chat_id": chat_id or TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "Markdown",
            })
            resp.raise_for_status()
        return True
    except Exception as exc:
        logger.error("Telegram send failed: %s", exc)
        return False


def send_otp_request(case_id: str) -> bool:
    """Notify staff that an OTP is needed for a case."""
    text = (
        f"🔐 *OTP Required*\n"
        f"Case: `{case_id}`\n\n"
        f"Reply with the OTP code to proceed."
    )
    return send_message(text)


def send_otp_received(case_id: str) -> bool:
    """Confirm to staff that the OTP was received and used."""
    text = (
        f"✅ *OTP Received*\n"
        f"Case: `{case_id}`\n\n"
        f"The OTP has been submitted. Continuing processing."
    )
    return send_message(text)


def send_otp_timeout(case_id: str) -> bool:
    """Notify staff that the OTP wait timed out."""
    text = (
        f"⏰ *OTP Timeout*\n"
        f"Case: `{case_id}`\n\n"
        f"Timed out waiting for OTP. The system will retry."
    )
    return send_message(text)


def set_webhook(url: str) -> bool:
    """Register the Telegram bot webhook pointing at our FastAPI endpoint."""
    if not TELEGRAM_BOT_TOKEN:
        return False
    payload: dict = {"url": url}
    if TELEGRAM_WEBHOOK_SECRET:
        payload["secret_token"] = TELEGRAM_WEBHOOK_SECRET
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(_bot_url("setWebhook"), json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("ok", False)
    except Exception as exc:
        logger.error("Telegram setWebhook failed: %s", exc)
        return False
