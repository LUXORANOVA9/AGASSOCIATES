"""Telegram Bot — OTP bridge + Aisha chat interface.

Staff commands:
  /start       — Register staff handle
  /otp         — Request next available OTP (FIFO)
  /otp gras    — Request OTP for GRAS portal
  /otp igr     — Request OTP for IGR portal
  /status      — Show pending OTP requests
  /cancel      — Cancel my pending request
  /aisha       — Toggle Aisha chat mode
  /aisha <msg> — Send a message to Aisha directly

In chat mode, all messages are forwarded to Aisha for processing.
"""

import os
import json
import logging
import asyncio
import sys
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
BOT_PORT = int(os.environ.get("TELEGRAM_BOT_PORT", "3003"))
AISHA_API_URL = os.environ.get("AISHA_API_URL", "http://localhost:8001/api/aisha/chat")
AISHA_API_KEY = os.environ.get("N8N_WEBHOOK_KEY", "")

OTP_TTL_SECONDS = 300  # 5 min

redis_client: Optional[aioredis.Redis] = None

# Track which chats are in Aisha mode
_aisha_chat_modes: set[int] = set()


def _is_aisha_mode(chat_id: int) -> bool:
    return chat_id in _aisha_chat_modes


# ── Redis helpers ────────────────────────────────────────────────────────

async def get_redis() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        url = REDIS_URL
        if REDIS_PASSWORD and "redis://" in url:
            url = url.replace("redis://", f"redis://:{REDIS_PASSWORD}@")
        redis_client = aioredis.from_url(url, decode_responses=True)
    return redis_client


def _pending_key(portal: str) -> str:
    return f"otp_pending:{portal}"


def _staff_key(chat_id: int) -> str:
    return f"otp_staff:{chat_id}"


def _aisha_mode_key(chat_id: int) -> str:
    return f"aisha_mode:{chat_id}"


# ── Aisha chat handler ───────────────────────────────────────────────────

async def _call_aisha_api(message: str, chat_id: int, username: str) -> Optional[str]:
    """Call the unified Aisha API and return the response text."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                AISHA_API_URL,
                json={
                    "message": message,
                    "platform": "telegram",
                    "platform_identity": str(chat_id),
                    "display_name": username,
                },
                headers={"x-api-key": AISHA_API_KEY} if AISHA_API_KEY else {},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("response")
    except httpx.HTTPStatusError as e:
        logger.error(f"Aisha API returned {e.response.status_code}: {e.response.text[:200]}")
        return None
    except Exception as e:
        logger.error(f"Aisha API call failed: {e}")
        return None


async def aisha_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Toggle Aisha mode or send a message to Aisha."""
    chat_id = update.effective_chat.id
    args = ctx.args

    if args:
        text = " ".join(args)
        username = update.effective_user.username or str(chat_id)
        await update.message.reply_text("🤖 Thinking...")
        response = await _call_aisha_api(text, chat_id, username)
        if response:
            await update.message.reply_text(response, parse_mode="HTML")
        else:
            await update.message.reply_text("❌ Sorry, I couldn't reach Aisha right now. Try again later.")
        return

    if chat_id in _aisha_chat_modes:
        _aisha_chat_modes.discard(chat_id)
        await update.message.reply_text(
            "🚫 **Aisha mode disabled.**\n\nYour messages will no longer be forwarded to Aisha.\n"
            "Use /aisha to enable again, or /otp for OTP requests.",
            parse_mode="HTML",
        )
    else:
        _aisha_chat_modes.add(chat_id)
        await update.message.reply_text(
            "✅ **Aisha mode enabled!** 🤖\n\n"
            "I'll forward your messages to Aisha, your AI Chief of Staff.\n\n"
            "You can ask about:\n"
            "• Case status & progress\n"
            "• Draft legal documents\n"
            "• NOI workflow & challans\n"
            "• General firm operations\n\n"
            "Send /aisha to disable this mode.\n"
            "Use /otp for OTP requests.",
            parse_mode="HTML",
        )


async def aisha_message_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Handle non-command messages in Aisha chat mode."""
    chat_id = update.effective_chat.id
    if not _is_aisha_mode(chat_id):
        return

    text = update.message.text
    if not text:
        return

    username = update.effective_user.username or str(chat_id)
    await update.message.reply_chat_action("typing")
    response = await _call_aisha_api(text, chat_id, username)

    # Split long messages
    if response:
        if len(response) > 4000:
            for i in range(0, len(response), 4000):
                chunk = response[i:i + 4000]
                await update.message.reply_text(chunk, parse_mode="HTML")
        else:
            await update.message.reply_text(response, parse_mode="HTML")
    else:
        await update.message.reply_text("❌ Aisha is unavailable right now. Please try again later.")


# ── OTP handlers ─────────────────────────────────────────────────────────

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Register staff member and link to their chat."""
    chat_id = update.effective_chat.id
    username = update.effective_user.username or str(chat_id)
    r = await get_redis()
    await r.hset(_staff_key(chat_id), mapping={
        "chat_id": str(chat_id),
        "username": username,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    })

    kb = [
        [InlineKeyboardButton("🤖 Chat with Aisha", callback_data="aisha_toggle")],
        [InlineKeyboardButton("🔐 Request OTP", callback_data="otp_menu")],
    ]
    await update.message.reply_text(
        f"✅ Registered as <b>{username}</b>\n\n"
        "<b>Commands:</b>\n"
        "/aisha — Chat with Aisha (toggle mode)\n"
        "/aisha &lt;message&gt; — Ask Aisha directly\n"
        "/otp — Request next available OTP\n"
        "/otp gras — Request GRAS OTP\n"
        "/otp igr — Request IGR OTP\n"
        "/status — View pending OTP requests\n"
        "/cancel — Cancel my OTP request\n\n"
        "<i>In Aisha mode, all messages go to Aisha automatically.</i>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(kb),
    )


async def request_otp(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    args = ctx.args
    portal = args[0].lower() if args else "any"

    if portal not in ("any", "gras", "igr", "cersai", "sbi", "noc"):
        await update.message.reply_text(
            f"❌ Unknown portal: <b>{portal}</b>\n"
            "Supported: gras, igr, cersai, sbi, noc (or no argument for any)",
            parse_mode="HTML",
        )
        return

    r = await get_redis()
    key = _pending_key(portal)

    await r.rpush(key, json.dumps({
        "chat_id": chat_id,
        "portal": portal,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "status": "waiting",
    }))
    await r.expire(key, OTP_TTL_SECONDS)

    await update.message.reply_text(
        f"⏳ <b>OTP requested</b> for portal: <b>{portal}</b>\n"
        "Waiting for SMS... You'll receive the code here automatically.",
        parse_mode="HTML",
    )
    logger.info("OTP requested by %s for portal %s", chat_id, portal)


async def status_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    r = await get_redis()

    lines = []
    for portal in ("any", "gras", "igr", "cersai"):
        key = _pending_key(portal)
        queue = await r.lrange(key, 0, -1)
        for item in queue:
            try:
                data = json.loads(item)
                if int(data["chat_id"]) == chat_id:
                    lines.append(f"• <b>{portal}</b> — requested {data['requested_at'][:19]}")
            except (json.JSONDecodeError, KeyError):
                continue

    if not lines:
        await update.message.reply_text("📭 No pending OTP requests from you.")
    else:
        await update.message.reply_text(
            "📋 <b>Your pending requests:</b>\n" + "\n".join(lines),
            parse_mode="HTML",
        )


async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    r = await get_redis()
    removed = 0

    for portal in ("any", "gras", "igr", "cersai", "sbi"):
        key = _pending_key(portal)
        queue = await r.lrange(key, 0, -1)
        for item in queue:
            try:
                data = json.loads(item)
                if int(data["chat_id"]) == chat_id:
                    await r.lrem(key, 1, item)
                    removed += 1
            except (json.JSONDecodeError, KeyError):
                continue

    if removed:
        await update.message.reply_text(f"✅ Cancelled <b>{removed}</b> pending request(s).", parse_mode="HTML")
    else:
        await update.message.reply_text("📭 No pending requests to cancel.")


# ── Callback handler ────────────────────────────────────────────────────

async def button_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == "aisha_toggle":
        chat_id = update.effective_chat.id
        if chat_id in _aisha_chat_modes:
            _aisha_chat_modes.discard(chat_id)
            await query.edit_message_text("🚫 Aisha mode disabled.")
        else:
            _aisha_chat_modes.add(chat_id)
            await query.edit_message_text(
                "✅ **Aisha mode enabled!** Send any message to chat with Aisha.",
                parse_mode="HTML",
            )
    elif query.data == "otp_menu":
        await query.edit_message_text(
            "🔐 Use /otp <portal> to request an OTP.\n\n"
            "Example: /otp gras\n\n"
            "Available portals: gras, igr, cersai, sbi, noc",
            parse_mode="HTML",
        )


# ── OTP delivery (called by AI agent / SMS webhook) ─────────────────────

async def deliver_otp(chat_id: int, portal: str, otp_code: str, app: Application):
    try:
        await app.bot.send_message(
            chat_id=chat_id,
            text=f"🔐 <b>OTP for {portal.upper()}</b>\n\n"
                 f"<code>{otp_code}</code>\n\n"
                 f"Expires in 5 minutes. Enter this on the {portal.upper()} portal.",
            parse_mode="HTML",
        )
        logger.info("OTP %s delivered to chat %s for portal %s", otp_code[:4] + "***", chat_id, portal)
        return True
    except Exception as e:
        logger.error("Failed to deliver OTP to %s: %s", chat_id, e)
        return False


async def process_incoming_sms(sms_text: str, sender: str, app: Application):
    import re
    r = await get_redis()

    otp_match = re.search(r'\b(\d{4,8})\b', sms_text)
    if not otp_match:
        logger.warning("No OTP found in SMS: %s", sms_text[:80])
        return False
    otp_code = otp_match.group(1)

    portal_map = {
        'gras': r'\bGRAS\b',
        'igr': r'\bIGR\b',
        'cersai': r'\bCERSAI\b',
        'sbi': r'\bSBI\b',
        'noc': r'\bNOC\b',
    }
    detected_portal = "any"
    for portal, pattern in portal_map.items():
        if re.search(pattern, sms_text, re.IGNORECASE):
            detected_portal = portal
            break

    for portal_key in (detected_portal, "any"):
        key = _pending_key(portal_key)
        queue_len = await r.llen(key)
        if queue_len == 0:
            continue

        raw = await r.lpop(key)
        if raw is None:
            continue

        try:
            req = json.loads(raw)
            chat_id = int(req["chat_id"])
            await deliver_otp(chat_id, detected_portal, otp_code, app)
            return True
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error("Invalid OTP request entry: %s", e)
            continue

    orphan_key = "otp_orphans"
    await r.rpush(orphan_key, json.dumps({
        "otp": otp_code,
        "portal": detected_portal,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "sender": sender,
        "sms_preview": sms_text[:100],
    }))
    await r.expire(orphan_key, 600)
    logger.info("No pending request for OTP %s — stored as orphan", otp_code[:4] + "***")
    return False


# ── Webhook endpoint for SMS ingestion ───────────────────────────────────

async def sms_webhook_handler(request_body: dict, app: Application):
    sms_text = request_body.get("text") or request_body.get("Body") or ""
    sender = request_body.get("from") or request_body.get("From") or "unknown"
    return await process_incoming_sms(sms_text, sender, app)


# ── Health endpoint ──────────────────────────────────────────────────────

async def health_check():
    import http.server
    import socketserver

    class HealthHandler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')

    with socketserver.TCPServer(("0.0.0.0", BOT_PORT), HealthHandler) as httpd:
        httpd.serve_forever()


# ── Main ─────────────────────────────────────────────────────────────────

async def main():
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set")
        return

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Register handlers (order matters: commands before catch-all)
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("aisha", aisha_command))
    app.add_handler(CommandHandler("otp", request_otp))
    app.add_handler(CommandHandler("status", status_handler))
    app.add_handler(CommandHandler("cancel", cancel))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, aisha_message_handler))
    app.add_handler(CallbackQueryHandler(button_callback))

    app.bot_data["application"] = app

    webhook_url = os.environ.get("TELEGRAM_WEBHOOK_URL", "")
    if webhook_url:
        await app.bot.set_webhook(url=webhook_url)
        logger.info("Telegram webhook set to %s", webhook_url)
    else:
        logger.info("No webhook URL set — starting polling mode")

    asyncio.create_task(health_check())

    logger.info("Telegram Bot started — Aisha mode available")
    await app.run_polling(allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    asyncio.run(main())
