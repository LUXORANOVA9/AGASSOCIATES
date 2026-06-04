"""AutoComms — Notification dispatcher for NOI status transitions.

Sends alerts via WhatsApp (n8n), Telegram, and Email when the NOI workflow
advances, stalls, or encounters errors.

Wired to NOIAgent._notify() — every NOI status transition fires a dispatch.
"""

import json
import logging
import os
from typing import Any, Dict, Optional

import httpx

from workforce.ledger import record_activity

logger = logging.getLogger(__name__)

# ── WhatsApp (via n8n) ───────────────────────────────────────────────────

N8N_WHATSAPP_SEND_URL = os.environ.get("N8N_WHATSAPP_SEND_URL", "")
N8N_WHATSAPP_TOKEN = os.environ.get("N8N_WHATSAPP_TOKEN", "")

# ── Telegram ─────────────────────────────────────────────────────────────

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_IDS = os.environ.get("ADMIN_CHAT_IDS", "")

# ── Email (via Resend) ───────────────────────────────────────────────────

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "aisha@agassociates.in")

# ── Template map ─────────────────────────────────────────────────────────

NOI_TEMPLATES = {
    "CHALLAN_GENERATED": {
        "title": "📄 Challan Generated",
        "emoji": "📄",
        "priority": "info",
    },
    "CHALLAN_PAID": {
        "title": "✅ Challan Paid",
        "emoji": "✅",
        "priority": "success",
    },
    "VERIFIED": {
        "title": "🔍 Documents Verified",
        "emoji": "🔍",
        "priority": "success",
    },
    "NOI_DROP_RECEIVED": {
        "title": "📨 NOI Drop Received",
        "emoji": "📨",
        "priority": "info",
    },
    "RECTIFY": {
        "title": "🔄 Rectification Needed",
        "emoji": "🔄",
        "priority": "warning",
    },
    "NOI_FILED": {
        "title": "📝 NOI Filed",
        "emoji": "📝",
        "priority": "success",
    },
    "ACKNOWLEDGED": {
        "title": "✅ NOI Acknowledged",
        "emoji": "✅",
        "priority": "success",
    },
    "MISMATCH": {
        "title": "⚠️ Document Mismatch",
        "emoji": "⚠️",
        "priority": "warning",
    },
    "REJECTED": {
        "title": "❌ NOI Rejected",
        "emoji": "❌",
        "priority": "critical",
    },
    "COMPLETED": {
        "title": "🎉 Case Completed",
        "emoji": "🎉",
        "priority": "success",
    },
}


class NotificationDispatcher:
    """Dispatch notifications across all channels for a given event."""

    async def dispatch(self, case_id: str, event: str, message: str) -> Dict[str, bool]:
        """Send notification across all configured channels.
        Returns dict of channel → success bool."""
        results = {}

        whatsapp_ok = await self._send_whatsapp(case_id, event, message)
        results["whatsapp"] = whatsapp_ok

        telegram_ok = await self._send_telegram(case_id, event, message)
        results["telegram"] = telegram_ok

        email_ok = await self._send_email(case_id, event, message)
        results["email"] = email_ok

        channels = [k for k, v in results.items() if v]
        if channels:
            record_activity(
                source="auto_comms",
                staff_kind="agent",
                staff_short_name="auto_comms",
                capability_code="comms.notify",
                case_id=case_id,
                summary=f"Notification sent via {', '.join(channels)}: {event}",
                payload={"event": event, "channels": channels},
                status="ok",
            )

        return results

    def _format_message(self, event: str, message: str) -> str:
        template = NOI_TEMPLATES.get(event, {"emoji": "🔔", "priority": "info"})
        return f"{template['emoji']} *{template['title']}*\n\n{message}"

    async def _send_whatsapp(self, case_id: str, event: str, message: str) -> bool:
        """Send WhatsApp via n8n webhook."""
        if not N8N_WHATSAPP_SEND_URL:
            return False

        text = self._format_message(event, message)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    N8N_WHATSAPP_SEND_URL,
                    json={
                        "case_id": case_id,
                        "event": event,
                        "body": text,
                        "priority": NOI_TEMPLATES.get(event, {}).get("priority", "info"),
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {N8N_WHATSAPP_TOKEN}" if N8N_WHATSAPP_TOKEN else "",
                    },
                )
                resp.raise_for_status()
                logger.info("WhatsApp notification sent for %s: %s", case_id, event)
                return True
        except Exception as exc:
            logger.warning("WhatsApp notification failed: %s", exc)
            return False

    async def _send_telegram(self, case_id: str, event: str, message: str) -> bool:
        """Send Telegram notification to admin/staff chats."""
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_IDS:
            return False

        text = self._format_message(event, message)
        text += f"\n\n🔗 Case: `{case_id}`"

        success = False
        for chat_id in TELEGRAM_CHAT_IDS.split(","):
            chat_id = chat_id.strip()
            if not chat_id:
                continue
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": text,
                            "parse_mode": "Markdown",
                        },
                    )
                    if resp.status_code == 200:
                        success = True
                    else:
                        logger.warning("Telegram send to %s returned %s", chat_id, resp.status_code)
            except Exception as exc:
                logger.warning("Telegram send to %s failed: %s", chat_id, exc)

        return success

    async def _send_email(self, case_id: str, event: str, message: str) -> bool:
        """Send email notification via Resend API."""
        if not RESEND_API_KEY:
            return False

        template = NOI_TEMPLATES.get(event, {"title": event, "emoji": "🔔"})
        html = f"""<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
<h2>{template['emoji']} {template['title']}</h2>
<p style="color: #333; line-height: 1.6;">{message}</p>
<hr style="border: none; border-top: 1px solid #eee;">
<p style="color: #999; font-size: 12px;">
  Case: <strong>{case_id}</strong><br>
  Sent by AG Associates AutoComms
</p>
</div>"""

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    json={
                        "from": EMAIL_FROM,
                        "to": [],  # populated from case data in production
                        "subject": f"{template['emoji']} {template['title']} — Case {case_id}",
                        "html": html,
                    },
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                )
                if resp.status_code == 200:
                    logger.info("Email notification sent for %s: %s", case_id, event)
                    return True
                logger.warning("Email send returned %s: %s", resp.status_code, resp.text[:200])
                return False
        except Exception as exc:
            logger.warning("Email notification failed: %s", exc)
            return False


dispatcher = NotificationDispatcher()
