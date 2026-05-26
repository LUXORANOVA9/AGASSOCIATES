"""Telegram Bot — OTP bridge + Aisha AI chat + Voice mode + Auto-forward.

Commands:
  /start       — Register staff, show all features
  /help        — Show this command list
  /aisha       — Toggle Aisha chat mode (text msgs go to Aisha)
  /aisha <msg> — Ask Aisha directly (one-off)
  /otp         — Request next available OTP (FIFO)
  /otp gras    — Request OTP for specific portal
  /autootp     — Auto-forward ALL incoming OTPs to this chat/group
  /voicemode   — Toggle spoken voice replies (TTS)
  /status      — Show pending OTP requests
  /cancel      — Cancel my pending OTP request

Voice messages are transcribed via Groq Whisper, sent to Aisha,
and replied with text + optional spoken voice (when voice mode on).
"""

import os
import json
import io
import signal
import logging
import asyncio
import sys
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, ContextTypes, filters

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
BOT_PORT = int(os.environ.get("TELEGRAM_BOT_PORT", "3003"))
AISHA_API_URL = os.environ.get("AISHA_API_URL", "http://localhost:8001/api/aisha/chat")
AISHA_API_KEY = os.environ.get("N8N_WEBHOOK_KEY", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")

OTP_TTL_SECONDS = 300
SMS_INCOMING_KEY = "sms:incoming"
AUTOFORWARD_SET_KEY = "otp_autoforward"
STAFF_SET_KEY = "otp_staff_registered"

TTSService = None

_voice_mode_chats: set[int] = set()
_aisha_chat_modes: set[int] = set()
redis_client: Optional[aioredis.Redis] = None


# ── Helpers ──────────────────────────────────────────────────────────────

def _is_aisha_mode(chat_id: int) -> bool:
    return chat_id in _aisha_chat_modes


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


def _autoforward_key() -> str:
    return AUTOFORWARD_SET_KEY


def _portal_label(portal: str) -> str:
    labels = {
        "idbi": "IDBI Bank", "icici": "ICICI Bank", "hdfc": "HDFC Bank",
        "axis": "Axis Bank", "sbi": "SBI Bank",
        "gras": "GRAS", "igr": "IGR", "cersai": "CERSAI", "noc": "NOC",
    }
    return labels.get(portal, portal.upper())


BANK_PATTERNS = {
    "idbi": r"\bIDBI\b", "icici": r"\bICICI\b",
    "hdfc": r"\bHDFC\b", "axis": r"\bAxis\b", "sbi": r"\bSBI\b",
}
PORTAL_MAP = {
    "gras": r"\bGRAS\b", "igr": r"\bIGR\b",
    "cersai": r"\bCERSAI\b", "sbi": r"\bSBI\b", "noc": r"\bNOC\b",
}


# ── Send helpers ─────────────────────────────────────────────────────────

async def _send_text(update: Update, text: str, parse_mode: str = "HTML"):
    """Send text, splitting if >4000 chars."""
    if len(text) > 4000:
        for i in range(0, len(text), 4000):
            await update.message.reply_text(text[i:i + 4000], parse_mode=parse_mode)
    else:
        await update.message.reply_text(text, parse_mode=parse_mode)


async def _reply_with_voice(update: Update, text: str, ctx: ContextTypes.DEFAULT_TYPE):
    """Send text reply + optional TTS voice reply if voice mode on."""
    chat_id = update.effective_chat.id
    await _send_text(update, text)
    if chat_id in _voice_mode_chats:
        audio = await _synthesize_speech(text)
        if audio:
            await update.message.reply_voice(voice=io.BytesIO(audio))


# ── Aisha API ────────────────────────────────────────────────────────────

async def _call_aisha_api(message: str, chat_id: int, username: str) -> Optional[str]:
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
            return resp.json().get("response")
    except httpx.HTTPStatusError as e:
        logger.error(f"Aisha API {e.response.status_code}: {e.response.text[:200]}")
        return None
    except Exception as e:
        logger.error(f"Aisha API call failed: {e}")
        return None


async def _call_aisha_and_reply(update: Update, text: str, ctx: ContextTypes.DEFAULT_TYPE):
    """Call Aisha and reply with text + optional voice."""
    chat_id = update.effective_chat.id
    username = update.effective_user.username or str(chat_id)
    await update.message.reply_chat_action("typing")
    response = await _call_aisha_api(text, chat_id, username)
    if response:
        await _reply_with_voice(update, response, ctx)
    else:
        await update.message.reply_text("❌ Aisha is unavailable right now. Please try again later.")


# ── Command: /help ───────────────────────────────────────────────────────

async def help_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cmds = [
        ("/start", "Register staff handle, show all features"),
        ("/help", "Show this help"),
        ("/aisha", "Toggle Aisha chat mode"),
        ("/aisha <msg>", "Ask Aisha a one-off question"),
        ("/voicemode", "Toggle spoken voice replies (TTS)"),
        ("/otp", "Request next available OTP"),
        ("/otp gras", "Request OTP for GRAS portal"),
        ("/otp igr", "Request OTP for IGR portal"),
        ("/autootp", "Auto-forward all OTPs to this chat"),
        ("/status", "Show pending OTP requests"),
        ("/cancel", "Cancel my pending OTP request"),
    ]
    lines = [f"<b>{cmd}</b> — {desc}" for cmd, desc in cmds]
    await update.message.reply_text(
        "🤖 <b>AG Associates Bot Commands</b>\n\n" + "\n".join(lines) +
        "\n\n<i>Send a voice message to talk to Aisha hands-free.</i>",
        parse_mode="HTML",
    )


# ── Command: /start ──────────────────────────────────────────────────────

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    username = update.effective_user.username or str(chat_id)
    r = await get_redis()
    await r.hset(_staff_key(chat_id), mapping={
        "chat_id": str(chat_id),
        "username": username,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    })
    await r.sadd(STAFF_SET_KEY, str(chat_id))

    kb = [
        [InlineKeyboardButton("🤖 Chat with Aisha", callback_data="aisha_toggle")],
        [InlineKeyboardButton("🔊 Voice Mode", callback_data="voice_toggle")],
        [InlineKeyboardButton("🔐 OTP Menu", callback_data="otp_menu")],
        [InlineKeyboardButton("🔄 Auto-Forward", callback_data="autootp_toggle")],
        [InlineKeyboardButton("❓ Help", callback_data="help")],
    ]
    await update.message.reply_text(
        f"✅ Registered <b>{username}</b>\n\n"
        "<b>Commands:</b>\n"
        "/aisha — Chat with Aisha (toggle)\n"
        "/aisha &lt;msg&gt; — Ask Aisha directly\n"
        "/voicemode — Toggle spoken voice replies\n"
        "/otp — Request OTP\n"
        "/autootp — Auto-forward OTPs here\n"
        "/status — View pending OTP requests\n"
        "/cancel — Cancel OTP request\n"
        "/help — Show all commands\n\n"
        "<i>Send a voice message anytime to talk to Aisha.</i>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(kb),
    )


# ── Command: /aisha ──────────────────────────────────────────────────────

async def aisha_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    args = ctx.args

    if args:
        text = " ".join(args)
        await update.message.reply_text("🤖 Thinking...")
        await _call_aisha_and_reply(update, text, ctx)
        return

    if chat_id in _aisha_chat_modes:
        _aisha_chat_modes.discard(chat_id)
        await update.message.reply_text(
            "🚫 **Aisha mode disabled.**\n\nUse /aisha to re-enable.",
            parse_mode="HTML",
        )
    else:
        _aisha_chat_modes.add(chat_id)
        await update.message.reply_text(
            "✅ **Aisha mode enabled!** 🤖\n\n"
            "All messages will be forwarded to Aisha.\n"
            "Send /aisha again to disable.\n"
            "Use /voicemode for spoken replies.",
            parse_mode="HTML",
        )


# ── Message handler: text → Aisha ───────────────────────────────────────

async def aisha_message_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not _is_aisha_mode(chat_id):
        return
    text = update.message.text
    if not text:
        return
    await _call_aisha_and_reply(update, text, ctx)


# ── Voice handler ────────────────────────────────────────────────────────

async def _transcribe_voice(audio_bytes: bytes, filename: str = "voice.ogg") -> Optional[str]:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            files = {"file": (filename, audio_bytes, "audio/ogg")}
            data = {"model": "whisper-large-v3", "language": "en"}
            resp = await client.post(
                f"{LLM_BASE_URL}/audio/transcriptions",
                files=files, data=data,
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
            )
            if resp.status_code != 200:
                logger.error("Whisper error %s: %s", resp.status_code, resp.text[:200])
                return None
            return resp.json().get("text", "").strip()
    except Exception as e:
        logger.error("Voice transcription failed: %s", e)
        return None


async def voice_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Handle voice messages — always routes to Aisha (no /aisha toggle needed)."""
    voice = update.message.voice
    if not voice:
        return

    chat_id = update.effective_chat.id
    await update.message.reply_chat_action("typing")

    voice_file = await ctx.bot.get_file(voice.file_id)
    audio_bytes = await voice_file.download_as_bytearray()

    transcribed = await _transcribe_voice(bytes(audio_bytes))
    if not transcribed:
        await update.message.reply_text("🎙️ Sorry, couldn't understand that. Please try again or type.")
        return

    await update.message.reply_text(f"🎙️ <i>Heard:</i> {transcribed}", parse_mode="HTML")
    await _call_aisha_and_reply(update, transcribed, ctx)


# ── TTS ──────────────────────────────────────────────────────────────────

async def _synthesize_speech(text: str) -> Optional[bytes]:
    global TTSService
    if TTSService is None:
        try:
            import edge_tts
            TTSService = edge_tts
        except ImportError:
            logger.warning("edge-tts not installed")
            return None
    try:
        communicate = TTSService.Communicate(text, voice="en-IN-NeerjaNeural")
        audio = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio += chunk["data"]
        return audio if audio else None
    except Exception as e:
        logger.error("TTS failed: %s", e)
        return None


# ── Command: /voicemode ─────────────────────────────────────────────────

async def voicemode_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if chat_id in _voice_mode_chats:
        _voice_mode_chats.discard(chat_id)
        await update.message.reply_text(
            "🔇 **Voice replies disabled.**\n\nText replies only.",
            parse_mode="HTML",
        )
    else:
        _voice_mode_chats.add(chat_id)
        await update.message.reply_text(
            "🔊 **Voice replies enabled!** 🎤\n\n"
            "Aisha will reply with text + spoken voice.\n"
            "Works for both typed and voice messages.\n"
            "Send /voicemode again to disable.",
            parse_mode="HTML",
        )


# ── OTP commands ─────────────────────────────────────────────────────────

async def request_otp(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    args = ctx.args
    portal = args[0].lower() if args else "any"
    valid = ("any", "gras", "igr", "cersai", "sbi", "noc")

    if portal not in valid:
        await update.message.reply_text(
            f"❌ Unknown portal: <b>{portal}</b>\n"
            f"Supported: {', '.join(valid)}",
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
        f"⏳ <b>OTP requested</b> for: <b>{portal}</b>\n"
        "You'll receive it here automatically.",
        parse_mode="HTML",
    )


async def status_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    r = await get_redis()
    lines = []
    for portal in ("any", "gras", "igr", "cersai"):
        key = _pending_key(portal)
        for item in await r.lrange(key, 0, -1):
            try:
                data = json.loads(item)
                if int(data["chat_id"]) == chat_id:
                    lines.append(f"• <b>{portal}</b> @ {data['requested_at'][:19]}")
            except (json.JSONDecodeError, KeyError):
                continue
    if not lines:
        await update.message.reply_text("📭 No pending OTP requests.")
    else:
        await update.message.reply_text("📋 <b>Your pending requests:</b>\n" + "\n".join(lines), parse_mode="HTML")


async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    r = await get_redis()
    removed = 0
    for portal in ("any", "gras", "igr", "cersai", "sbi"):
        key = _pending_key(portal)
        for item in await r.lrange(key, 0, -1):
            try:
                if int(json.loads(item)["chat_id"]) == chat_id:
                    await r.lrem(key, 1, item)
                    removed += 1
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    if removed:
        await update.message.reply_text(f"✅ Cancelled <b>{removed}</b> request(s).", parse_mode="HTML")
    else:
        await update.message.reply_text("📭 No pending requests to cancel.")


async def autootp_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    r = await get_redis()
    is_enabled = await r.sismember(_autoforward_key(), str(chat_id))
    if is_enabled:
        await r.srem(_autoforward_key(), str(chat_id))
        await update.message.reply_text(
            "🚫 **Auto-OTP forwarding disabled.**\n\nUse /otp for manual requests.",
            parse_mode="HTML",
        )
    else:
        await r.sadd(_autoforward_key(), str(chat_id))
        kind = "group" if update.effective_chat.type in ("group", "supergroup") else "chat"
        await update.message.reply_text(
            f"✅ **Auto-OTP forwarding enabled!** 🔄\n\n"
            f"All OTPs from IDBI, ICICI, GRAS, IGR, etc.\n"
            f"will be forwarded to this {kind} automatically.\n\n"
            f"Send /autootp again to disable.",
            parse_mode="HTML",
        )


# ── Callback handler ────────────────────────────────────────────────────

async def button_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    chat_id = update.effective_chat.id

    if query.data == "aisha_toggle":
        if chat_id in _aisha_chat_modes:
            _aisha_chat_modes.discard(chat_id)
            await query.edit_message_text("🚫 Aisha mode disabled.")
        else:
            _aisha_chat_modes.add(chat_id)
            await query.edit_message_text("✅ Aisha mode enabled! Send any message.")

    elif query.data == "voice_toggle":
        if chat_id in _voice_mode_chats:
            _voice_mode_chats.discard(chat_id)
            await query.edit_message_text("🔇 Voice replies disabled.")
        else:
            _voice_mode_chats.add(chat_id)
            await query.edit_message_text("🔊 Voice replies enabled! Send voice or text.")

    elif query.data == "autootp_toggle":
        import json as _json
        r = await get_redis()
        is_on = await r.sismember(_autoforward_key(), str(chat_id))
        if is_on:
            await r.srem(_autoforward_key(), str(chat_id))
            await query.edit_message_text("🚫 Auto-OTP disabled.")
        else:
            await r.sadd(_autoforward_key(), str(chat_id))
            await query.edit_message_text("✅ Auto-OTP enabled! OTPs forwarded here.")

    elif query.data == "otp_menu":
        await query.edit_message_text(
            "🔐 **Request an OTP**\n\n"
            "Use /otp &lt;portal&gt;\n\n"
            "Portals: gras, igr, cersai, sbi, noc\n\n"
            "Or enable /autootp to auto-forward all.",
            parse_mode="HTML",
        )

    elif query.data == "help":
        await help_command(update, ctx)


# ── Background SMS listener ─────────────────────────────────────────────

async def _sms_listener(app: Application):
    r = await get_redis()
    while True:
        try:
            result = await r.blpop(SMS_INCOMING_KEY, timeout=30)
            if result is None:
                continue
            _, raw = result
            data = json.loads(raw)
            await process_incoming_sms(
                sms_text=data.get("text", ""),
                sender=data.get("from", "unknown"),
                app=app,
            )
        except (asyncio.TimeoutError, TypeError):
            continue
        except Exception as e:
            logger.error("SMS listener: %s", e)
            await asyncio.sleep(5)


# ── OTP delivery ────────────────────────────────────────────────────────

async def deliver_otp(chat_id: int, portal: str, otp_code: str, app: Application):
    label = _portal_label(portal)
    try:
        await app.bot.send_message(
            chat_id=chat_id,
            text=f"🔐 <b>OTP for {label}</b>\n\n<code>{otp_code}</code>\n\n"
                 f"Expires in 5 minutes.",
            parse_mode="HTML",
        )
        logger.info("OTP %s delivered to %s for %s", otp_code[:4] + "***", chat_id, label)
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

    detected = "any"
    for portal, pattern in {**PORTAL_MAP, **BANK_PATTERNS}.items():
        if re.search(pattern, sms_text, re.IGNORECASE):
            detected = portal
            break

    for pk in (detected, "any"):
        key = _pending_key(pk)
        raw = await r.lpop(key)
        if raw is None:
            continue
        try:
            req = json.loads(raw)
            await deliver_otp(int(req["chat_id"]), detected, otp_code, app)
            return True
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error("Invalid OTP request: %s", e)
            continue

    autoforward_ids = await r.smembers(_autoforward_key())
    if autoforward_ids:
        label = _portal_label(detected) if detected != "any" else "BANK"
        for cid_str in autoforward_ids:
            try:
                await deliver_otp(int(cid_str), label, otp_code, app)
            except (ValueError, TypeError):
                continue
        logger.info("OTP auto-forwarded to %d chats", len(autoforward_ids))
        return True

    await r.rpush("otp_orphans", json.dumps({
        "otp": otp_code, "portal": detected,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "sender": sender, "sms_preview": sms_text[:100],
    }))
    await r.expire("otp_orphans", 600)
    return False


async def sms_webhook_handler(request_body: dict, app: Application):
    sms_text = request_body.get("text") or request_body.get("Body") or ""
    sender = request_body.get("from") or request_body.get("From") or "unknown"
    return await process_incoming_sms(sms_text, sender, app)


# ── Health endpoint ──────────────────────────────────────────────────────

def run_health_check():
    import http.server, socketserver, threading

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            status = json.dumps({
                "status": "ok",
                "aisha_mode_chats": len(_aisha_chat_modes),
                "voice_mode_chats": len(_voice_mode_chats),
            }).encode()
            self.wfile.write(status)
        def log_message(self, *a): pass

    httpd = socketserver.TCPServer(("0.0.0.0", BOT_PORT), H)
    httpd.serve_forever()


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set")
        return

    import threading
    health_thread = threading.Thread(target=run_health_check, daemon=True)
    health_thread.start()

    async def post_init(app: Application):
        asyncio.create_task(_sms_listener(app))

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("aisha", aisha_command))
    app.add_handler(CommandHandler("otp", request_otp))
    app.add_handler(CommandHandler("autootp", autootp_command))
    app.add_handler(CommandHandler("voicemode", voicemode_command))
    app.add_handler(CommandHandler("status", status_handler))
    app.add_handler(CommandHandler("cancel", cancel))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, aisha_message_handler))
    app.add_handler(MessageHandler(filters.VOICE, voice_handler))
    app.add_handler(CallbackQueryHandler(button_callback))

    app.bot_data["application"] = app

    webhook_url = os.environ.get("TELEGRAM_WEBHOOK_URL", "")
    if webhook_url:
        app.bot.set_webhook(url=webhook_url)
        logger.info("Webhook set to %s", webhook_url)
    else:
        logger.info("Polling mode")

    logger.info("AG Telegram Bot started")
    app.run_polling(allowed_updates=["message", "callback_query", "voice"])


if __name__ == "__main__":
    main()
