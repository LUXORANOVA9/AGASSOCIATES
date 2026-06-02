import os
import secrets
import importlib.util
from dotenv import load_dotenv
load_dotenv()

# Dynamic import to silence IDE warnings when module is not in the system path
sentry_sdk = None
if importlib.util.find_spec("sentry_sdk"):
    import sentry_sdk
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional
from voice.voice_api import router as voice_router
from workforce import workforce_router
from auth import oauth_router
from playground import playground_router, session_manager as _playground_sm
from pydantic import BaseModel
from controller_agent import UnifiedController
from agents import process_rental_request
from telegram_bot import TELEGRAM_BOT_TOKEN



ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# 1. Sentry Initialization (Must happen before FastAPI is initialized)
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if SENTRY_DSN:
    _default_traces = 0.1 if IS_PRODUCTION else 1.0
    _default_profiles = 0.01 if IS_PRODUCTION else 1.0
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", _default_traces)),
        profiles_sample_rate=float(os.environ.get("SENTRY_PROFILES_SAMPLE_RATE", _default_profiles)),
        environment=ENVIRONMENT,
    )

# 2. FastAPI Application Instance
app = FastAPI(
    title="AG Associates - Luxor9 LegalOS API",
    version="2.0.0",
    description="Deterministic Multi-Agent Legal Infrastructure"
)

# 3. CORS Configuration (Strictly for Next.js Frontend)
origins = [
    "http://localhost:3000",
    "https://luxor9-legalos.vercel.app",
]
_extra = os.environ.get("CORS_EXTRA_ORIGINS", "")
if _extra:
    origins.extend([o.strip() for o in _extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice_router)
app.include_router(workforce_router)
app.include_router(oauth_router)
app.include_router(playground_router)


@app.on_event("shutdown")
async def _shutdown_playground():
    await _playground_sm.shutdown()

# 4. Health Check Endpoint (For Vercel/Docker probing)
@app.post("/webhooks/whatsapp", tags=["Ingestion"])
async def whatsapp_webhook(payload: Dict[str, Any], x_api_key: Optional[str] = Header(default=None, alias="x-api-key")):
    """
    Entry point for n8n WhatsApp triggers.
    Expects payload with 'message', 'sender', and optional 'org_id'.
    Requires authentication via x-api-key.
    """
    # Authenticate using the same logic as n8n intake
    _verify_n8n_key(x_api_key)

    raw_input = payload.get("message")
    sender = payload.get("sender", "whatsapp_user")
    org_id = payload.get("org_id")

    if not raw_input:
        raise HTTPException(status_code=400, detail="Missing 'message' in payload")

    # Run the synchronous LangGraph pipeline in a separate thread
    import asyncio
    import logging
    logger = logging.getLogger("uvicorn.error")
    
    try:
        result = await asyncio.to_thread(process_rental_request, raw_input, sender, org_id)
        return result
    except Exception as e:
        logger.exception(f"Error in whatsapp_webhook: {str(e)}")
        return {
            "success": False,
            "error": "Internal server error during processing",
            "detail": str(e) if not IS_PRODUCTION else "An unexpected error occurred"
        }

class AgreementRequest(BaseModel):
    message: str
    sender: Optional[str] = "api_user"

@app.post("/api/generate-agreement", tags=["AI"])
async def generate_agreement(
    request: AgreementRequest, 
    x_org_id: Optional[str] = Header(default=None, alias="X-Org-ID"),
    x_api_key: Optional[str] = Header(default=None, alias="x-api-key")
):
    """
    Direct API entry for generating rental agreements.
    Uses X-Org-ID header for tenant isolation.
    Requires authentication via x-api-key.
    """
    # Authenticate
    _verify_n8n_key(x_api_key)

    # Run the synchronous LangGraph pipeline in a separate thread
    import asyncio
    import logging
    logger = logging.getLogger("uvicorn.error")

    try:
        result = await asyncio.to_thread(process_rental_request, request.message, request.sender, x_org_id)
        return result
    except Exception as e:
        logger.exception(f"Error in generate_agreement: {str(e)}")
        return {
            "success": False,
            "error": "Internal server error during agreement generation",
            "detail": str(e) if not IS_PRODUCTION else "An unexpected error occurred"
        }

@app.get("/health", tags=["System"])
async def health_check():
    """Returns 200 OK if the system is fully operational."""
    return {"status": "ok", "agent_pool": "ready", "version": "2.0.0"}

# 5. Core Webhook Entrypoint for n8n (Asynchronous)
N8N_WEBHOOK_KEY = os.environ.get("N8N_WEBHOOK_KEY", "")


def _verify_n8n_key(x_api_key: Optional[str] = Header(default=None, alias="x-api-key")) -> None:
    if not N8N_WEBHOOK_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="webhook auth not configured")
    if not x_api_key or not secrets.compare_digest(x_api_key, N8N_WEBHOOK_KEY):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid api key")


@app.post("/webhooks/n8n/intake", tags=["Ingestion"])
async def n8n_intake_webhook(payload: Dict[str, Any], x_api_key: Optional[str] = Header(default=None, alias="x-api-key")):
    """
    Stub webhook for n8n intake. Acknowledges receipt only — the LangGraph/CrewAI
    pipeline is not yet wired in here. Requires the X-Api-Key header to match
    N8N_WEBHOOK_KEY.
    """
    _verify_n8n_key(x_api_key)
    return {"status": "accepted", "message": "Payload received (pipeline dispatch not yet implemented)"}

# 6. Sentry Error Testing Endpoint (dev only)
if not IS_PRODUCTION:
    @app.get("/debug-sentry", tags=["System"])
    async def trigger_error():
        """Explicitly triggers a zero division error for Sentry testing."""
        raise ZeroDivisionError("Sentry debug error: division by zero triggered intentionally.")


# ============================================================================
# UNIFIED CONTROLLER (Conversations + MCP)
# ============================================================================

unified_controller = UnifiedController()

class UnifiedChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

@app.post("/api/unified/chat", tags=["AI"])
async def unified_chat(request: UnifiedChatRequest):
    """
    Experimental endpoint for the Unified Workforce Controller.
    Uses OpenAI Conversations API and MCP tools.
    """
    try:
        result = await unified_controller.handle_request(
            user_input=request.message,
            conversation_id=request.conversation_id
        )
        return result
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Unified Controller error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TELEGRAM BOT WEBHOOK (OTP from staff)
# ============================================================================

import asyncio
import redis.asyncio as aioredis

_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")


@app.post("/api/telegram/webhook")
async def telegram_webhook(payload: dict):
    """Receive Telegram bot updates (staff OTP replies or /start command)."""
    message = payload.get("message") or {}
    chat_id = str(message.get("chat", {}).get("id", ""))
    text = (message.get("text") or "").strip()
    from_user = message.get("from", {})

    if not chat_id or not text:
        return {"ok": False, "reason": "missing chat_id or text"}

    # /start command — echo chat info back to user
    if text == "/start":
        msg = (
            f"👋 Hello! I'm Ayesha.\n\n"
            f"Your chat ID: `{chat_id}`\n"
            f"Username: @{from_user.get('username', 'N/A')}\n"
            f"Name: {from_user.get('first_name', '')} {from_user.get('last_name', '')}\n\n"
            f"Send this chat ID to the admin to complete setup."
        )
        from telegram_bot import TELEGRAM_BOT_TOKEN
        import httpx
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(url, json={"chat_id": int(chat_id), "text": msg, "parse_mode": "Markdown"})
        return {"ok": True, "handled": "/start"}

    # Look up the pending case for this chat
    key = f"otp_waiting:{chat_id}"
    try:
        r = aioredis.from_url(_REDIS_URL)
        case_id = await r.get(key)
        if not case_id:
            await r.aclose()
            return {"ok": False, "reason": "no pending OTP request for this chat"}
        case_id = case_id.decode("utf-8")

        otp_key = f"otp:{case_id}"
        await r.setEx(otp_key, 300, text)
        await r.delete(key)
        await r.aclose()

        logger.info(f"Telegram OTP received for case {case_id}")
        return {"ok": True, "case_id": case_id}
    except Exception as exc:
        logger.error(f"Telegram webhook error: {exc}")
        return {"ok": False, "reason": str(exc)}


@app.get("/api/telegram/get-chat-id")
async def get_telegram_chat_id():
    """Poll Telegram for recent messages to discover the chat ID.
    Useful for initial setup before webhook is registered.
    """
    from telegram_bot import TELEGRAM_BOT_TOKEN
    import httpx
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        data = resp.json()
    if not data.get("ok"):
        return {"ok": False, "reason": "Telegram API error"}
    updates = data.get("result", [])
    if not updates:
        return {"ok": False, "reason": "No updates found. Message @ag_associates_bot with /start first."}
    seen = {}
    for upd in updates:
        msg = upd.get("message") or {}
        chat = msg.get("chat") or {}
        cid = chat.get("id")
        if cid:
            seen[cid] = {
                "chat_id": str(cid),
                "type": chat.get("type"),
                "title": chat.get("title"),
                "username": chat.get("username"),
                "first_name": chat.get("first_name"),
                "last_message": (msg.get("text") or "")[:100],
            }
    return {"ok": True, "chats": list(seen.values())}


@app.post("/api/telegram/setup-webhook")
async def setup_telegram_webhook():
    """Configure the Telegram bot to send updates to this server."""
    if not TELEGRAM_BOT_TOKEN:
        return {"ok": False, "reason": "TELEGRAM_BOT_TOKEN not set"}

    from telegram_bot import set_webhook

    host = os.environ.get("TELEGRAM_WEBHOOK_HOST", "")
    if not host:
        return {"ok": False, "reason": "TELEGRAM_WEBHOOK_HOST not set"}

    webhook_url = f"{host.rstrip('/')}/api/telegram/webhook"
    ok = set_webhook(webhook_url)
    return {"ok": ok, "webhook_url": webhook_url}


if __name__ == "__main__":

    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
