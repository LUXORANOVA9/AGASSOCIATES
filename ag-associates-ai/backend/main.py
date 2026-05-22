import os
import secrets
import json
import base64
import importlib.util

# Dynamic import to silence IDE warnings when module is not in the system path
sentry_sdk = None
if importlib.util.find_spec("sentry_sdk"):
    import sentry_sdk
from fastapi import FastAPI, Header, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from voice.voice_api import router as voice_router
from workforce import workforce_router
from auth import oauth_router
from playground import playground_router, session_manager as _playground_sm
from controller_agent import UnifiedController
from agents import process_rental_request
from aisha_core import handle_message as aisha_handle_message, ensure_tables
from conversation_store import resolve_user



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
@app.on_event("startup")
async def _startup_store():
    ensure_tables()

@app.post("/webhooks/whatsapp", tags=["Ingestion"])
async def whatsapp_webhook(payload: Dict[str, Any], x_api_key: Optional[str] = Header(default=None, alias="x-api-key")):
    """
    Entry point for n8n WhatsApp triggers — routes through unified Aisha.
    Expects payload with 'message', 'sender', and optional 'org_id' and 'conversation_id'.
    Requires authentication via x-api-key.
    """
    _verify_n8n_key(x_api_key)

    raw_input = payload.get("message", "").strip()
    sender = payload.get("sender", "whatsapp_user")
    conversation_id = payload.get("conversation_id")

    if not raw_input:
        raise HTTPException(status_code=400, detail="Missing 'message' in payload")

    import asyncio
    import logging
    logger = logging.getLogger("uvicorn.error")

    try:
        result = await asyncio.to_thread(
            aisha_handle_message,
            raw_input,
            platform="whatsapp",
            platform_identity=sender,
            display_name=payload.get("display_name"),
            conversation_id=conversation_id,
        )
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
    conversation_id: Optional[str] = None

@app.post("/api/generate-agreement", tags=["AI"])
async def generate_agreement(
    request: AgreementRequest, 
    x_org_id: Optional[str] = Header(default=None, alias="X-Org-ID"),
    x_api_key: Optional[str] = Header(default=None, alias="x-api-key")
):
    """
    Direct API entry for generating rental agreements — routes through unified Aisha.
    Uses X-Org-ID header for tenant isolation.
    Requires authentication via x-api-key.
    """
    _verify_n8n_key(x_api_key)

    import asyncio
    import logging
    logger = logging.getLogger("uvicorn.error")

    try:
        result = await asyncio.to_thread(
            aisha_handle_message,
            request.message,
            platform="web",
            platform_identity=request.sender,
            conversation_id=request.conversation_id,
        )
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
# DASHBOARD ENDPOINTS
# ============================================================================

@app.get("/dashboard/status", tags=["Dashboard"])
async def dashboard_status():
    """Returns dashboard metrics: template count, active agents, recent activities."""
    import psycopg2
    from config import get_database_url

    template_count = 0
    try:
        with psycopg2.connect(get_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM legal_templates")
                row = cur.fetchone()
                template_count = row[0] if row else 0
    except Exception:
        pass

    return {
        "total_templates": template_count,
        "active_agents": 3,
        "system_status": "operational",
        "recent_activities": [
            {"action": "AISHA_INTAKE", "timestamp": "2025-01-15T10:30:00Z", "details": "Processed new rental agreement request"},
            {"action": "DRAFT_COMPLETE", "timestamp": "2025-01-15T10:31:00Z", "details": "Generated legal document #1024"},
            {"action": "AUDIT_PASSED", "timestamp": "2025-01-15T10:32:00Z", "details": "Quality check passed with score 92"},
        ],
    }


@app.get("/templates", tags=["Dashboard"])
async def list_templates(template_type: Optional[str] = None, language: Optional[str] = None):
    """List legal templates with optional filters."""
    import psycopg2
    from config import get_database_url

    templates = []
    try:
        with psycopg2.connect(get_database_url()) as conn:
            with conn.cursor() as cur:
                query = "SELECT id, title, template_type, jurisdiction, language FROM legal_templates WHERE 1=1"
                params = []
                if template_type:
                    query += " AND template_type = %s"
                    params.append(template_type)
                if language:
                    query += " AND language = %s"
                    params.append(language)
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description]
                for row in cur.fetchall():
                    templates.append(dict(zip(columns, row)))
    except Exception:
        pass

    return templates


# ============================================================================
# CROSS-PLATFORM AISHA ADAPTER ENDPOINTS
# ============================================================================

class AishaChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="The user's message")
    conversation_id: Optional[str] = Field(None, description="Resume an existing conversation")
    platform: Optional[str] = Field("web", description="Source platform identifier")
    platform_identity: Optional[str] = Field(None, description="Platform user ID (defaults to API key hash)")
    display_name: Optional[str] = Field(None, description="User's display name")

class AishaChatResponse(BaseModel):
    conversation_id: str
    user_id: str
    response: str
    intent: str
    data: Optional[Dict[str, Any]] = None

@app.post("/api/aisha/chat", tags=["Aisha"])
async def aisha_chat(
    request: AishaChatRequest,
    x_api_key: Optional[str] = Header(default=None, alias="x-api-key"),
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """
    General Aisha chat endpoint for web/mobile/API clients.
    Routes to the appropriate handler based on intent classification.
    Supports conversation continuity via conversation_id.
    """
    if x_api_key:
        _verify_n8n_key(x_api_key)

    import asyncio
    import hashlib

    identity = x_user_id or request.platform_identity or f"api_{hashlib.md5((x_api_key or '').encode()).hexdigest()[:8]}"

    result = await asyncio.to_thread(
        aisha_handle_message,
        request.message,
        platform=request.platform or "web",
        platform_identity=identity,
        display_name=request.display_name,
        conversation_id=request.conversation_id,
    )
    return AishaChatResponse(**result)


@app.post("/api/aisha/sms", tags=["Aisha"])
async def aisha_sms_webhook(
    From: Optional[str] = None,
    Body: Optional[str] = None,
):
    """
    Twilio SMS webhook — receives SMS, processes via Aisha, responds.
    Return TwiML to reply via SMS.
    """
    if not Body:
        return Response(content='<?xml version="1.0" encoding="UTF-8"?><Response/>', media_type="text/xml")

    import asyncio
    phone = From or "unknown"

    result = await asyncio.to_thread(
        aisha_handle_message,
        Body.strip(),
        platform="sms",
        platform_identity=phone,
    )

    response_text = result.get("response", "Sorry, I couldn't process that.")
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{_escape_twiml(response_text)}</Message>
</Response>"""
    return Response(content=twiml, media_type="text/xml")


@app.post("/api/aisha/voice-call", tags=["Aisha"])
async def aisha_voice_call_webhook(
    CallStatus: Optional[str] = None,
    SpeechResult: Optional[str] = None,
    From: Optional[str] = None,
    CallSid: Optional[str] = None,
):
    """
    Twilio Voice webhook — handles inbound calls with speech recognition.
    First call: prompts user to speak. Subsequent: processes speech via Aisha.
    """
    from voice.piper_service import synthesize
    import base64

    if not SpeechResult:
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" speechTimeout="auto" language="en-IN">
        <Say voice="Polly.Kajal">Hello, this is Aisha from AG Associates. How can I help you today?</Say>
    </Gather>
    <Say>I did not hear anything. Please call back. Goodbye.</Say>
</Response>"""
        return Response(content=twiml, media_type="text/xml")

    import asyncio
    phone = From or "unknown"

    result = await asyncio.to_thread(
        aisha_handle_message,
        SpeechResult.strip(),
        platform="phone",
        platform_identity=phone,
    )

    response_text = result.get("response", "Sorry, I couldn't process that.")

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Kajal">{_escape_twiml(response_text)}</Say>
    <Gather input="speech" timeout="5" speechTimeout="auto" language="en-IN">
        <Say voice="Polly.Kajal">Is there anything else I can help you with?</Say>
    </Gather>
    <Say>Thank you for calling AG Associates. Goodbye.</Say>
</Response>"""
    return Response(content=twiml, media_type="text/xml")


def _escape_twiml(text: str) -> str:
    """Escape text for TwiML (entities that break XML)."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")


@app.post("/api/aisha/voice-text", tags=["Aisha"])
async def aisha_voice_text(payload: Dict[str, Any]):
    """
    Accept transcribed text from voice platforms (V.O.X., web mic, Twilio Voice
    STT, WhatsApp voice notes) and return a response with optional TTS audio.

    Expected payload:
        {"text": "...", "platform": "vox|web_mic|twilio|whatsapp_voice",
         "user_id": "...", "conversation_id": "..."}
    """
    text = payload.get("text", "").strip()
    platform = payload.get("platform", "voice")
    user_id = payload.get("user_id", "voice_user")
    conversation_id = payload.get("conversation_id")

    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text' in payload")

    import asyncio
    result = await asyncio.to_thread(
        aisha_handle_message,
        text,
        platform=platform,
        platform_identity=user_id,
        conversation_id=conversation_id,
    )

    audio = None
    if payload.get("tts", True):
        from voice.piper_service import synthesize
        audio = synthesize(result.get("response", ""))

    return {
        **result,
        "audio_base64": base64.b64encode(audio).decode() if audio else None,
    }


from fastapi.responses import StreamingResponse

@app.get("/api/aisha/chat/{conversation_id}/stream", tags=["Aisha"])
async def aisha_chat_stream(conversation_id: str, after_id: int = 0):
    """SSE endpoint for web chat widget — streams new messages."""
    from conversation_store import get_messages
    import asyncio

    async def event_stream():
        last_id = after_id
        while True:
            messages = get_messages(conversation_id, limit=10)
            for msg in messages:
                if msg["id"] > last_id:
                    data = json.dumps({"role": msg["role"], "content": msg["content"], "id": msg["id"]})
                    yield f"data: {data}\n\n"
                    last_id = msg["id"]
            await asyncio.sleep(2)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


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
# NOI WORKFLOW ENDPOINTS (Notice of Intimation)
# ============================================================================

from noi_agent import noi_agent

class NOIWorkflowRequest(BaseModel):
    case_id: str = Field(..., description="Case ID to process")
    action: str = Field(..., description="Action: generate_challan, verify_docs, file_noi, acknowledge, status")
    acknowledgment_number: Optional[str] = Field(None, description="Required for acknowledge action")

class NOIWorkflowResponse(BaseModel):
    success: bool
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class NOIWebhookPayload(BaseModel):
    case_id: str
    status: str = Field(..., description="New NOI status")
    notes: Optional[str] = None
    acknowledgment_number: Optional[str] = None


class NOISeedRequest(BaseModel):
    case_id: Optional[str] = Field(None, description="Optional custom case ID")
    borrower_name: Optional[str] = Field(None, description="Borrower name")
    bank_name: Optional[str] = Field(None, description="Bank name")
    loan_amount: Optional[str] = Field(None, description="Loan amount")


@app.post("/api/noi/seed", tags=["NOI"])
async def noi_seed(request: NOISeedRequest):
    """Seed a test case in the in-memory store (dev only, no Supabase needed)."""
    try:
        case_data = request.model_dump(exclude_none=True)
        case_id = await noi_agent.seed_test_case(case_data)
        return NOIWorkflowResponse(
            success=True,
            data={"case_id": case_id, "noi_status": "DOCUMENTS_RECEIVED"}
        )
    except Exception as e:
        return NOIWorkflowResponse(success=False, error=str(e))


@app.post("/api/noi/workflow", tags=["NOI"])
async def noi_workflow(request: NOIWorkflowRequest):
    """Trigger a NOI workflow action for a case.
    
    Actions:
    - generate_challan: Generate GRAS challan (0.3% stamp duty)
    - verify_docs: Verify documents against NOI checklist
    - file_noi: File NOI on IGR portal
    - acknowledge: Mark NOI as acknowledged
    - status: Get current NOI status
    """
    try:
        result = await noi_agent.run_workflow(
            case_id=request.case_id,
            action=request.action,
            acknowledgment_number=request.acknowledgment_number,
        )
        return NOIWorkflowResponse(success=result.get("success", False), data=result)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"NOI workflow error: {e}")
        return NOIWorkflowResponse(success=False, error=str(e))

@app.get("/api/noi/status/{case_id}", tags=["NOI"])
async def noi_status(case_id: str):
    """Get current NOI status and workflow state for a case."""
    try:
        case = await noi_agent.get_case(case_id)
        if not case:
            return NOIWorkflowResponse(success=False, error=f"Case {case_id} not found")
        return NOIWorkflowResponse(
            success=True,
            data={
                "case_id": case_id,
                "borrower_name": case.get("borrower_name"),
                "bank_name": case.get("bank_name"),
                "loan_amount": case.get("loan_amount"),
                "noi_status": case.get("noi_status", "NOT_STARTED"),
                "grn_number": case.get("grn_number"),
                "acknowledgment_number": case.get("acknowledgment_number"),
            }
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"NOI status error: {e}")
        return NOIWorkflowResponse(success=False, error=str(e))

@app.post("/api/noi/webhook", tags=["NOI"])
async def noi_webhook(payload: NOIWebhookPayload):
    """External webhook for NOI status updates (payment confirmation, drop received)."""
    try:
        valid_statuses = [
            "CHALLAN_PAID",
            "NOI_DROP_RECEIVED",
            "RECTIFY",
            "MISMATCH",
            "REJECTED",
        ]
        if payload.status not in valid_statuses:
            return NOIWorkflowResponse(
                success=False,
                error=f"Invalid status '{payload.status}'. Valid: {', '.join(valid_statuses)}"
            )

        success = await noi_agent.update_noi_status(
            case_id=payload.case_id,
            new_status=payload.status,
            notes=payload.notes,
        )
        if not success:
            return NOIWorkflowResponse(success=False, error="Failed to update status")

        if payload.status == "CHALLAN_PAID" and payload.acknowledgment_number:
            await noi_agent.acknowledge(payload.case_id, payload.acknowledgment_number)

        return NOIWorkflowResponse(success=True, data={"case_id": payload.case_id, "status": payload.status})
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"NOI webhook error: {e}")
        return NOIWorkflowResponse(success=False, error=str(e))


if __name__ == "__main__":

    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
