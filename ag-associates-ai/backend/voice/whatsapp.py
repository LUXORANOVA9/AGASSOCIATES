"""WhatsApp bridge — outbound confirmation prompts + inbound reply parsing.

Outbound: posts to an n8n webhook URL (the n8n flow handles the actual
WhatsApp Cloud API call). Keeps this codebase free of WhatsApp tokens.

Inbound: helpers to classify a free-text reply as approve/deny/unknown.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

N8N_WHATSAPP_SEND_URL = os.environ.get("N8N_WHATSAPP_SEND_URL", "")
N8N_WHATSAPP_TOKEN = os.environ.get("N8N_WHATSAPP_TOKEN", "")

CONFIRM_TTL_SECONDS = int(os.environ.get("VOICE_CONFIRM_TTL", "30"))

APPROVE_RE = re.compile(r"^\s*(y|yes|haan|haa|confirm|ok|okay|approve|do it)\b", re.IGNORECASE)
DENY_RE = re.compile(r"^\s*(n|no|nahi|nahin|cancel|stop|abort|deny)\b", re.IGNORECASE)


def send_confirm_prompt(phone: str, transcript: str, tool_name: str, args: dict, command_id: str) -> bool:
    """Send a 'reply YES to execute' message. Returns True on 2xx."""
    if not N8N_WHATSAPP_SEND_URL:
        logger.warning("N8N_WHATSAPP_SEND_URL unset — confirmation prompt skipped")
        return False

    body = (
        f"🤖 Vyasa heard: \"{transcript}\"\n"
        f"Tool: {tool_name}\n"
        f"Args: {args}\n\n"
        f"Reply YES within {CONFIRM_TTL_SECONDS}s to execute, or NO to cancel.\n"
        f"(id: {command_id[:8]})"
    )

    headers = {"Content-Type": "application/json"}
    if N8N_WHATSAPP_TOKEN:
        headers["Authorization"] = f"Bearer {N8N_WHATSAPP_TOKEN}"

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(N8N_WHATSAPP_SEND_URL, headers=headers, json={"to": phone, "body": body})
            resp.raise_for_status()
        return True
    except Exception as exc:
        logger.error("WhatsApp confirm send failed: %s", exc)
        return False


def classify_reply(text: str) -> str:
    """Return 'approve' | 'deny' | 'unknown'."""
    if not text:
        return "unknown"
    if APPROVE_RE.match(text):
        return "approve"
    if DENY_RE.match(text):
        return "deny"
    return "unknown"
