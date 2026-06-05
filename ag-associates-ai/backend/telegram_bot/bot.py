"""Telegram Bot — OTP bridge + Aisha AI + Voice mode + Auto-forward.

Commands:
  /start       — Register, show all features
  /help        — Command reference
  /aisha       — Toggle Aisha chat mode (text msgs → Aisha)
  /aisha <msg> — Ask Aisha directly
  /voicemode   — Toggle spoken voice replies (TTS)
  /hindi       — Toggle Hindi voice (hi-IN-SwaraNeural)
  /audit       — Upload Excel for financial audit
  /otp         — Request next available OTP
  /otp gras    — Request OTP for specific portal
  /autootp     — Auto-forward ALL incoming OTPs here
  /claim       — Claim orphan OTPs (no sender matched)
  /history     — View recent OTP history
  /status      — Show pending OTP requests
  /cancel      — Cancel my pending OTP request

Voice messages → always routed to Aisha (no /aisha toggle needed).
Voice mode ON → Aisha replies with text + spoken voice (TTS).
"""

import os
import json
import io
import re
import signal
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

import redis.asyncio as aioredis
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CallbackQueryHandler, CommandHandler,
    MessageHandler, ContextTypes, filters,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
BOT_PORT = int(os.environ.get("TELEGRAM_BOT_PORT", "3003"))
DOMAIN = os.environ.get("DOMAIN", "")
AISHA_API_URL = os.environ.get("AISHA_API_URL", "http://localhost:8001/api/aisha/chat")
AISHA_API_KEY = os.environ.get("N8N_WEBHOOK_KEY", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")

AG_PLATFORM_URL = os.environ.get("AG_PLATFORM_PUBLIC_URL", "http://localhost:3000")
TELEGRAM_GROUP_ID = os.environ.get("TELEGRAM_GROUP_ID", "")

OTP_TTL_SECONDS = 300
SMS_INCOMING_KEY = "sms:incoming"
AUTOFORWARD_SET_KEY = "otp_autoforward"
STAFF_SET_KEY = "otp_staff_registered"
OTP_HISTORY_KEY = "otp_history"
ORPHAN_KEY = "otp_orphans"


RATE_LIMIT_SECONDS = 10
_ratelimit: dict[int, float] = {}
_voice_mode_chats: set[int] = set()
_aisha_chat_modes: set[int] = set()
_hindi_chats: set[int] = set()
redis_client: Optional[aioredis.Redis] = None
TTSService = None


# ── Helpers ──────────────────────────────────────────────────────────────

def _is_aisha_mode(chat_id: int) -> bool:
    return chat_id in _aisha_chat_modes


def _check_ratelimit(chat_id: int) -> Optional[int]:
    now = datetime.now(timezone.utc).timestamp()
    last = _ratelimit.get(chat_id, 0)
    elapsed = now - last
    if elapsed < RATE_LIMIT_SECONDS:
        return int(RATE_LIMIT_SECONDS - elapsed)
    _ratelimit[chat_id] = now
    return None


async def get_redis() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        url = REDIS_URL
        if REDIS_PASSWORD and "redis://" in url:
            url = url.replace("redis://", f"redis://:{REDIS_PASSWORD}@")
        redis_client = aioredis.from_url(url, decode_responses=True, socket_timeout=None)
    return redis_client


def _pending_key(portal: str) -> str:
    return f"otp_pending:{portal}"


def _staff_key(chat_id: int) -> str:
    return f"otp_staff:{chat_id}"


def _autoforward_key() -> str:
    return AUTOFORWARD_SET_KEY


PORTAL_LABELS = {
    "idbi": "IDBI Bank", "icici": "ICICI Bank", "hdfc": "HDFC Bank",
    "axis": "Axis Bank", "sbi": "SBI",
    "gras": "GRAS", "igr": "IGR", "cersai": "CERSAI", "noc": "NOC",
}

BANK_PATTERNS = {
    "idbi": r"\bIDBI\b", "icici": r"\bICICI\b",
    "hdfc": r"\bHDFC\b", "axis": r"\bAxis\b", "sbi": r"\bSBI\b",
}
PORTAL_MAP = {
    "gras": r"\bGRAS\b", "igr": r"\bIGR\b",
    "cersai": r"\bCERSAI\b", "sbi": r"\bSBI\b", "noc": r"\bNOC\b",
}


def _portal_label(portal: str) -> str:
    return PORTAL_LABELS.get(portal, portal.upper())


async def _send_text(update: Update, text: str, parse_mode: str = "HTML"):
    if len(text) > 4000:
        for i in range(0, len(text), 4000):
            await update.message.reply_text(text[i:i + 4000], parse_mode=parse_mode)
    else:
        await update.message.reply_text(text, parse_mode=parse_mode)


async def _reply_with_voice(update: Update, text: str, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    await _send_text(update, text)
    if chat_id in _voice_mode_chats:
        lang = "hi" if chat_id in _hindi_chats else "en"
        audio = await _synthesize_speech(text, lang)
        if audio:
            await update.message.reply_voice(voice=io.BytesIO(audio))


# ── Aisha API ────────────────────────────────────────────────────────────

async def _call_aisha_api(message: str, chat_id: int, username: str) -> Optional[str]:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                AISHA_API_URL,
                json={"message": message, "platform": "telegram",
                       "platform_identity": str(chat_id), "display_name": username},
                headers={"x-api-key": AISHA_API_KEY} if AISHA_API_KEY else {},
            )
            resp.raise_for_status()
            return resp.json().get("response")
    except httpx.HTTPStatusError as e:
        logger.error(f"Aisha API {e.response.status_code}: {e.response.text[:200]}")
        return None
    except Exception as e:
        logger.error(f"Aisha API failed: {e}")
        return None


async def _call_aisha_and_reply(update: Update, text: str, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    identity = update.effective_user.username or str(chat_id)
    await update.message.reply_chat_action("typing")
    resp = await _call_aisha_api(text, chat_id, identity)
    if resp:
        await _reply_with_voice(update, resp, ctx)
    else:
        await update.message.reply_text("❌ Aisha is unavailable. Try later.")


# ── Excel audit ──────────────────────────────────────────────────────────

async def audit_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📊 <b>Financial Auditor</b>\n\n"
        "Send me an Excel file (.xlsx) and I'll analyze it:\n"
        "• Bank statements → transactions, balances, anomalies\n"
        "• Balance sheets → A=L+E check, ratios\n"
        "• Profit & Loss → margins, trends\n"
        "• Any financial sheet → numeric summary\n\n"
        "Just upload the file or forward it here.",
        parse_mode="HTML",
    )


async def document_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    doc = update.message.document
    if not doc:
        return
    if not doc.file_name or not doc.file_name.lower().endswith((".xlsx", ".xls")):
        await update.message.reply_text("Please send an .xlsx or .xls file.")
        return

    await update.message.reply_chat_action("typing")
    await update.message.reply_text("📊 Analyzing...")

    f = await ctx.bot.get_file(doc.file_id)
    file_bytes = await f.download_as_bytearray()

    try:
        from finance_auditor import audit_excel
        report = audit_excel(bytes(file_bytes), doc.file_name)
        if len(report) > 4000:
            for i in range(0, len(report), 4000):
                await update.message.reply_text(report[i:i + 4000], parse_mode="HTML")
        else:
            await update.message.reply_text(report, parse_mode="HTML")
    except Exception as e:
        logger.error("Audit error: %s", e)
        await update.message.reply_text(f"❌ Audit failed: {e}")


# ── TTS ──────────────────────────────────────────────────────────────────

async def _synthesize_speech(text: str, lang: str = "en") -> Optional[bytes]:
    global TTSService
    if TTSService is None:
        try:
            import edge_tts
            TTSService = edge_tts
        except ImportError:
            return None
    voice = "hi-IN-SwaraNeural" if lang == "hi" else "en-IN-NeerjaNeural"
    try:
        c = TTSService.Communicate(text, voice=voice)
        audio = b""
        async for chunk in c.stream():
            if chunk["type"] == "audio":
                audio += chunk["data"]
        return audio if audio else None
    except Exception as e:
        logger.error("TTS failed: %s", e)
        return None


# ── OTP delivery ─────────────────────────────────────────────────────────

async def deliver_otp(chat_id: int, portal: str, otp_code: str, app: Application) -> bool:
    label = _portal_label(portal)
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ Received", callback_data="otp_done"),
         InlineKeyboardButton("🔄 Resend", callback_data=f"otp_resend:{portal}:{otp_code}")]
    ])
    try:
        await app.bot.send_message(
            chat_id=chat_id,
            text=f"🔐 <b>OTP for {label}</b>\n\n<code>{otp_code}</code>\n\n"
                 f"Expires in 5 minutes.",
            parse_mode="HTML",
            reply_markup=kb,
        )
        logger.info("OTP %s → %s (%s)", otp_code[:4] + "***", chat_id, label)
        return True
    except Exception as e:
        logger.error("OTP delivery failed to %s: %s", chat_id, e)
        return False


async def process_incoming_sms(sms_text: str, sender: str, app: Application) -> bool:
    r = await get_redis()
    otp_match = re.search(r'\b(\d{4,8})\b', sms_text)
    if not otp_match:
        return False
    otp_code = otp_match.group(1)

    detected = "any"
    all_pats = {**PORTAL_MAP, **BANK_PATTERNS}
    for p, pat in all_pats.items():
        if re.search(pat, sms_text, re.IGNORECASE):
            detected = p
            break

    for pk in (detected, "any"):
        raw = await r.lpop(_pending_key(pk))
        if raw is None:
            continue
        try:
            req = json.loads(raw)
            cid = int(req["chat_id"])
            ok = await deliver_otp(cid, detected, otp_code, app)
            await r.rpush(OTP_HISTORY_KEY, json.dumps({
                "ts": datetime.now(timezone.utc).isoformat(),
                "chat_id": cid, "portal": detected, "otp": otp_code[:4] + "***",
                "sender": sender, "delivered": ok,
            }))
            await r.ltrim(OTP_HISTORY_KEY, -200, -1)
            return ok
        except (json.JSONDecodeError, KeyError, ValueError):
            continue

    af_ids = await r.smembers(_autoforward_key())
    if af_ids:
        label = _portal_label(detected) if detected != "any" else "BANK"
        ok = False
        for cid_str in af_ids:
            try:
                if await deliver_otp(int(cid_str), label, otp_code, app):
                    ok = True
            except (ValueError, TypeError):
                continue
        return ok

    await r.rpush(ORPHAN_KEY, json.dumps({
        "otp": otp_code, "portal": detected,
        "ts": datetime.now(timezone.utc).isoformat(),
        "sender": sender, "sms": sms_text[:100],
    }))
    await r.expire(ORPHAN_KEY, 3600)
    return False


async def sms_webhook_handler(body: dict, app: Application):
    text = body.get("text") or body.get("Body") or ""
    sender = body.get("from") or body.get("From") or "unknown"
    return await process_incoming_sms(text, sender, app)


# ── Commands ─────────────────────────────────────────────────────────────

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    user = update.effective_user.username or str(cid)
    r = await get_redis()
    await r.hset(_staff_key(cid), mapping={
        "chat_id": str(cid), "username": user,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    })
    await r.sadd(STAFF_SET_KEY, str(cid))

    # Bridge to Express: persist chat_id for Claim verification
    if ctx.args and len(ctx.args) > 0:
        token = ctx.args[0]
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                base_url = AG_PLATFORM_URL.rstrip("/")
                mr = await client.get(f"{base_url}/api/team/member-by-token/{token}")
                if mr.status_code == 200:
                    member = mr.json()
                    bind_resp = await client.post(
                        f"{base_url}/api/team/telegram-bind",
                        json={
                            "memberId": member.get("member_id") or member["id"],
                            "chatId": str(cid),
                            "username": user,
                        },
                    )
                    if bind_resp.status_code == 200:
                        logger.info("Telegram bound for %s (%s)", user, cid)
        except Exception as e:
            logger.error("Telegram bind bridge failed: %s", e)

    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("🤖 Chat with Aisha", callback_data="aisha_toggle"),
         InlineKeyboardButton("🔊 Voice", callback_data="voice_toggle")],
        [InlineKeyboardButton("🇮🇳 Hindi Voice", callback_data="hindi_toggle"),
         InlineKeyboardButton("🔄 Auto-OTP", callback_data="autootp_toggle")],
        [InlineKeyboardButton("🔐 OTP Menu", callback_data="otp_menu"),
         InlineKeyboardButton("📋 Claim", callback_data="claim")],
        [InlineKeyboardButton("📜 History", callback_data="history"),
         InlineKeyboardButton("❓ Help", callback_data="help")],
    ])
    await update.message.reply_text(
        f"✅ Registered <b>{user}</b>\n\n"
        "<b>Key commands:</b>\n"
        "/aisha — Chat with assistant\n"
        "/voicemode — Spoken replies (TTS)\n"
        "/hindi — Hindi voice (Swara)\n"
        "/otp — Request OTP\n"
        "/autootp — Auto-forward OTPs here\n"
        "/claim — Claim orphan OTPs\n"
        "/history — View recent OTPs\n\n"
        "<i>Send a voice message anytime to talk hands-free.</i>",
        parse_mode="HTML", reply_markup=kb,
    )


async def help_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cmds = [
        ("/start", "Register, show menu"),
        ("/help", "This help"),
        ("/aisha [msg]", "Toggle Aisha mode or ask one-off"),
        ("/voicemode", "Toggle spoken TTS replies"),
        ("/hindi", "Toggle Hindi voice (Swara)"),
        ("/otp [portal]", "Request OTP (gras/igr/cersai/sbi/noc)"),
        ("/autootp", "Auto-forward all OTPs here"),
        ("/claim", "Claim orphan OTPs"),
        ("/history", "Recent OTP history"),
        ("/status", "Pending OTP requests"),
        ("/cancel", "Cancel OTP request"),
        ("/audit", "Upload Excel for financial audit"),
    ]
    lines = [f"<b>{c}</b> — {d}" for c, d in cmds]
    await update.message.reply_text(
        "🤖 <b>AG Bot Commands</b>\n\n" + "\n".join(lines),
        parse_mode="HTML",
    )


async def aisha_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    if ctx.args:
        await update.message.reply_text("🤖 Thinking...")
        await _call_aisha_and_reply(update, " ".join(ctx.args), ctx)
        return
    if cid in _aisha_chat_modes:
        _aisha_chat_modes.discard(cid)
        await update.message.reply_text("🚫 Aisha mode off.")
    else:
        _aisha_chat_modes.add(cid)
        await update.message.reply_text("✅ Aisha mode on! Send any message.")


async def voicemode_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    if cid in _voice_mode_chats:
        _voice_mode_chats.discard(cid)
        await update.message.reply_text("🔇 Voice replies off.")
    else:
        _voice_mode_chats.add(cid)
        await update.message.reply_text("🔊 Voice replies on! Aisha speaks back.")


async def hindi_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    if cid in _hindi_chats:
        _hindi_chats.discard(cid)
        await update.message.reply_text("🇮🇳 Hindi voice off. Using English voice.")
    else:
        _hindi_chats.add(cid)
        await update.message.reply_text(
            "🇮🇳 <b>Hindi voice on!</b> 🎤\n\n"
            "Aisha will speak in <b>Hindi</b> (female voice).\n"
            "Voice messages will auto-detect language.\n\n"
            "Send /hindi again to switch back to English.",
            parse_mode="HTML",
        )


async def request_otp(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    cooldown = _check_ratelimit(cid)
    if cooldown:
        await update.message.reply_text(f"⏳ Wait {cooldown}s before next request.")
        return

    portal = ctx.args[0].lower() if ctx.args else "any"
    valid = ("any", "gras", "igr", "cersai", "sbi", "noc")
    if portal not in valid:
        await update.message.reply_text(
            f"❌ Unknown portal. Supported: {', '.join(valid)}")
        return

    r = await get_redis()
    await r.rpush(_pending_key(portal), json.dumps({
        "chat_id": cid, "portal": portal,
        "ts": datetime.now(timezone.utc).isoformat(),
    }))
    await r.expire(_pending_key(portal), OTP_TTL_SECONDS)
    await update.message.reply_text(f"⏳ OTP requested for <b>{portal}</b>.", parse_mode="HTML")


async def claim_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    r = await get_redis()
    orphans = await r.lrange(ORPHAN_KEY, 0, -1)
    if not orphans:
        await update.message.reply_text("📭 No orphan OTPs available.")
        return

    cid = update.effective_chat.id
    claimed = 0
    for raw in list(orphans):
        try:
            data = json.loads(raw)
            otp = data["otp"]
            portal = data.get("portal", "any")
            await deliver_otp(cid, portal, otp, ctx.application)
            await r.lrem(ORPHAN_KEY, 1, raw)
            claimed += 1
        except (json.JSONDecodeError, KeyError):
            continue

    await update.message.reply_text(f"✅ Claimed <b>{claimed}</b> orphan OTP(s).", parse_mode="HTML")


async def history_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    r = await get_redis()
    entries = await r.lrange(OTP_HISTORY_KEY, 0, 19)
    if not entries:
        await update.message.reply_text("📭 No OTP history yet.")
        return

    lines = []
    for raw in entries:
        try:
            d = json.loads(raw)
            label = _portal_label(d.get("portal", "?"))
            otp = d.get("otp", "****")
            ts = d.get("ts", "")[11:19]
            ok = "✅" if d.get("delivered") else "❌"
            lines.append(f"{ok} {ts} <b>{label}</b> <code>{otp}</code>")
        except (json.JSONDecodeError, KeyError):
            continue

    await update.message.reply_text(
        "📜 <b>Recent OTPs</b> (last 20)\n\n" + "\n".join(lines),
        parse_mode="HTML",
    )


async def status_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    r = await get_redis()
    lines = []
    for portal in ("any", "gras", "igr", "cersai"):
        for item in await r.lrange(_pending_key(portal), 0, -1):
            try:
                d = json.loads(item)
                if int(d["chat_id"]) == cid:
                    lines.append(f"• <b>{portal}</b> @ {d['ts'][:19]}")
            except (json.JSONDecodeError, KeyError):
                continue
    if not lines:
        await update.message.reply_text("📭 No pending OTP requests.")
    else:
        await update.message.reply_text("📋 <b>Your pending requests:</b>\n" + "\n".join(lines), parse_mode="HTML")


async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    r = await get_redis()
    removed = 0
    for portal in ("any", "gras", "igr", "cersai", "sbi"):
        key = _pending_key(portal)
        for item in await r.lrange(key, 0, -1):
            try:
                if int(json.loads(item)["chat_id"]) == cid:
                    await r.lrem(key, 1, item)
                    removed += 1
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    if removed:
        await update.message.reply_text(f"✅ Cancelled {removed} request(s).")
    else:
        await update.message.reply_text("📭 Nothing to cancel.")


async def autootp_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    r = await get_redis()
    on = await r.sismember(_autoforward_key(), str(cid))
    if on:
        await r.srem(_autoforward_key(), str(cid))
        await update.message.reply_text("🚫 Auto-OTP off.")
    else:
        await r.sadd(_autoforward_key(), str(cid))
        kind = "group" if update.effective_chat.type in ("group", "supergroup") else "chat"
        await update.message.reply_text(f"✅ Auto-OTP on! All OTPs forwarded to this {kind}.")


# ── Message handlers ─────────────────────────────────────────────────────

async def aisha_message_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _is_aisha_mode(update.effective_chat.id):
        return
    text = update.message.text
    if text:
        await _call_aisha_and_reply(update, text, ctx)


async def voice_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    voice = update.message.voice
    if not voice:
        return

    cid = update.effective_chat.id
    await update.message.reply_chat_action("typing")

    f = await ctx.bot.get_file(voice.file_id)
    audio = await f.download_as_bytearray()

    import httpx
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{LLM_BASE_URL}/audio/transcriptions",
                files={"file": ("voice.ogg", bytes(audio), "audio/ogg")},
                data={"model": "whisper-large-v3"},
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
            )
            if resp.status_code != 200:
                await update.message.reply_text("🎙️ Transcription failed.")
                return
            transcribed = resp.json().get("text", "").strip()
    except Exception as e:
        logger.error("Whisper error: %s", e)
        await update.message.reply_text("🎙️ Transcription error.")
        return

    if not transcribed:
        await update.message.reply_text("🎙️ Couldn't understand. Try again.")
        return

    await update.message.reply_text(f"🎙️ <i>Heard:</i> {transcribed}", parse_mode="HTML")
    await _call_aisha_and_reply(update, transcribed, ctx)


# ── Callback handler ────────────────────────────────────────────────────

async def button_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    cid = update.effective_chat.id

    if q.data == "aisha_toggle":
        if cid in _aisha_chat_modes:
            _aisha_chat_modes.discard(cid)
            await q.edit_message_text("🚫 Aisha mode off.")
        else:
            _aisha_chat_modes.add(cid)
            await q.edit_message_text("✅ Aisha mode on! Send any message.")

    elif q.data == "voice_toggle":
        if cid in _voice_mode_chats:
            _voice_mode_chats.discard(cid)
            await q.edit_message_text("🔇 Voice replies off.")
        else:
            _voice_mode_chats.add(cid)
            await q.edit_message_text("🔊 Voice replies on! Aisha speaks back.")

    elif q.data == "hindi_toggle":
        if cid in _hindi_chats:
            _hindi_chats.discard(cid)
            await q.edit_message_text("🇮🇳 Hindi voice off. Using English voice.")
        else:
            _hindi_chats.add(cid)
            await q.edit_message_text("🇮🇳 Hindi voice on! Swara (female Hindi) voice.")

    elif q.data == "autootp_toggle":
        r = await get_redis()
        on = await r.sismember(_autoforward_key(), str(cid))
        if on:
            await r.srem(_autoforward_key(), str(cid))
            await q.edit_message_text("🚫 Auto-OTP off.")
        else:
            await r.sadd(_autoforward_key(), str(cid))
            await q.edit_message_text("✅ Auto-OTP on!")

    elif q.data == "otp_menu":
        await q.edit_message_text(
            "🔐 <b>OTP Requests</b>\n\n"
            "/otp — Next available\n"
            "/otp gras — GRAS portal\n"
            "/otp igr — IGR portal\n"
            "/otp cersai — CERSAI\n"
            "/otp sbi — SBI\n"
            "/otp noc — NOC\n\n"
            "Or enable /autootp for auto-forward.",
            parse_mode="HTML",
        )

    elif q.data == "claim":
        await claim_command(update, ctx)

    elif q.data == "history":
        await history_command(update, ctx)

    elif q.data == "help":
        await help_command(update, ctx)

    elif q.data == "otp_done":
        await q.edit_message_text(q.message.text_html + "\n\n✅ Marked as received.")
        await q.message.reply_text("Great! OTP marked as delivered.")

    elif q.data.startswith("otp_resend:"):
        parts = q.data.split(":")
        if len(parts) == 3:
            portal = parts[1]
            code = parts[2]
            await deliver_otp(cid, portal, code, ctx.application)
            await q.edit_message_text(q.message.text_html + "\n\n🔄 Resent.")


# ── Error handler ───────────────────────────────────────────────────────

async def error_handler(update: Optional[Update], ctx: ContextTypes.DEFAULT_TYPE):
    logger.error("Unhandled error: %s", ctx.error, exc_info=ctx.error)
    try:
        if update and update.effective_chat:
            await ctx.bot.send_message(
                chat_id=update.effective_chat.id,
                text="❌ Sorry, something went wrong. Please try again.",
            )
    except Exception:
        pass


# ── Group OTP callback removed — OTPs posted directly to group, no claim-race


# ── Job queue ────────────────────────────────────────────────────────────

async def cleanup_orphans(ctx: Optional[ContextTypes.DEFAULT_TYPE] = None):
    """Periodic job: expire old orphans (redundant with Redis EXPIRE, but safe)."""
    r = await get_redis()
    now = datetime.now(timezone.utc).timestamp()
    for raw in await r.lrange(ORPHAN_KEY, 0, -1):
        try:
            d = json.loads(raw)
            ts = d.get("ts", "")
            if ts:
                age = now - datetime.fromisoformat(ts).timestamp()
                if age > 3600:
                    await r.lrem(ORPHAN_KEY, 1, raw)
        except (json.JSONDecodeError, ValueError, TypeError):
            await r.lrem(ORPHAN_KEY, 1, raw)


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
            logger.error("SMS listener error: %s", e)
            await asyncio.sleep(5)


async def _group_otp_listener(app: Application):
    """Subscribe to otp:incoming pub/sub, post OTPs directly to the group ops room.

    No claim/race mechanism — bank OTPs expire in ~30s so we just broadcast
    immediately. Staff in the group reads and uses it.
    """
    group_id = TELEGRAM_GROUP_ID
    if not group_id:
        logger.info("TELEGRAM_GROUP_ID not set — group ops room disabled")
        return

    url = REDIS_URL
    if REDIS_PASSWORD and "redis://" in url:
        url = url.replace("redis://", f"redis://:{REDIS_PASSWORD}@")
    sub_client = aioredis.from_url(url, decode_responses=True, socket_timeout=None)
    pubsub = sub_client.pubsub()
    await pubsub.subscribe("otp:incoming")
    logger.info("Group OTP listener subscribed to otp:incoming (direct-post mode)")

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                data = json.loads(message["data"])
                otp_code = data.get("otp", "")
                portal = data.get("portal", "unknown")
                sender = data.get("sender", "unknown")

                label = _portal_label(portal)

                await app.bot.send_message(
                    chat_id=int(group_id),
                    text=(
                        f"🔐 <b>OTP — {label}</b>\n\n"
                        f"<code>{otp_code}</code>\n\n"
                        f"<b>From:</b> {sender}\n"
                        f"<b>Arrived:</b> {datetime.now(timezone.utc).strftime('%H:%M:%S')}\n"
                        f"<i>Expires in ~30s — use immediately.</i>"
                    ),
                    parse_mode="HTML",
                )

            except Exception as e:
                logger.error("Group OTP post error: %s", e)
    finally:
        await pubsub.unsubscribe("otp:incoming")
        await sub_client.close()


async def _cleanup_loop(app: Application):
    """Periodic cleanup of stale orphans."""
    while True:
        await asyncio.sleep(300)
        try:
            await cleanup_orphans(None)
        except Exception as e:
            logger.error("Cleanup error: %s", e)


# ── Health endpoint ──────────────────────────────────────────────────────

def run_health_check():
    import http.server, socketserver, threading

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "aisha_mode": len(_aisha_chat_modes),
                "voice_mode": len(_voice_mode_chats),
            }).encode())
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
        asyncio.create_task(_group_otp_listener(app))
        asyncio.create_task(_cleanup_loop(app))
        webhook_url = os.environ.get("TELEGRAM_WEBHOOK_URL", "")
        if webhook_url:
            await app.bot.set_webhook(url=webhook_url)
            logger.info("Webhook set to %s", webhook_url)
        else:
            logger.info("Polling mode")

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("aisha", aisha_command))
    app.add_handler(CommandHandler("voicemode", voicemode_command))
    app.add_handler(CommandHandler("hindi", hindi_command))
    app.add_handler(CommandHandler("otp", request_otp))
    app.add_handler(CommandHandler("autootp", autootp_command))
    app.add_handler(CommandHandler("claim", claim_command))
    app.add_handler(CommandHandler("history", history_command))
    app.add_handler(CommandHandler("status", status_handler))
    app.add_handler(CommandHandler("cancel", cancel))
    app.add_handler(CommandHandler("audit", audit_command))

    app.add_handler(MessageHandler(filters.Document.ALL, document_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, aisha_message_handler))
    app.add_handler(MessageHandler(filters.VOICE, voice_handler))
    app.add_handler(CallbackQueryHandler(button_callback))

    app.add_error_handler(error_handler)

    app.bot_data["application"] = app

    logger.info("AG Telegram Bot started")
    app.run_polling(allowed_updates=["message", "callback_query", "voice"])


if __name__ == "__main__":
    main()
