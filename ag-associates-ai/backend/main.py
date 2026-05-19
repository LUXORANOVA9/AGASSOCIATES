import os
import secrets
import importlib.util

# Dynamic import to silence IDE warnings when module is not in the system path
sentry_sdk = None
if importlib.util.find_spec("sentry_sdk"):
    import sentry_sdk
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional
from voice.voice_api import router as voice_router
from workforce import workforce_router
from auth import oauth_router
from playground import playground_router, session_manager as _playground_sm
from pydantic import BaseModel
from controller_agent import UnifiedController
from agents import process_rental_request
from integrations.nesl import (
    NeslFilingRequest,
    NeslFilingResult,
    get_nesl_client,
    shutdown_nesl_client,
)
import psycopg2
from psycopg2.extras import Json
from config import get_database_url, NESL_USE_MOCK



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


@app.on_event("shutdown")
async def _shutdown_nesl():
    await shutdown_nesl_client()

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
# NeSL FILING
# ============================================================================
# Frontend (frontend/app/dashboard/page.tsx) POSTs to this endpoint at the end
# of every workflow cycle. Body is currently empty; NeslFilingRequest fields
# are all optional so an empty body still validates.
# TODO: gate this endpoint with _verify_n8n_key before flipping to a
# production client — see integrations/nesl.py for the prod stub.

def _persist_nesl_filing(
    result: NeslFilingResult,
    req: NeslFilingRequest,
) -> None:
    """Write a NeSL filing audit row. Blocking — call via asyncio.to_thread."""
    conn = psycopg2.connect(get_database_url())
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nesl_filings (
                    transaction_id, status, provider,
                    document_id, case_id, org_id,
                    request, response
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (transaction_id) DO NOTHING
                """,
                (
                    result.transaction_id,
                    result.status,
                    result.provider,
                    req.document_id,
                    req.case_id,
                    req.org_id,
                    Json(req.model_dump(mode="json")),
                    Json(result.model_dump(mode="json")),
                ),
            )
        conn.commit()
    finally:
        conn.close()


def _persist_nesl_failure(req: NeslFilingRequest, error: str) -> None:
    """Audit a failed NeSL filing attempt. Blocking — call via asyncio.to_thread."""
    import uuid
    transaction_id = f"NESL-FAILED-{uuid.uuid4().hex[:12].upper()}"
    provider = "mock" if NESL_USE_MOCK else "production"
    conn = psycopg2.connect(get_database_url())
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nesl_filings (
                    transaction_id, status, provider,
                    document_id, case_id, org_id,
                    request, error
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    transaction_id,
                    "failed",
                    provider,
                    req.document_id,
                    req.case_id,
                    req.org_id,
                    Json(req.model_dump(mode="json")),
                    error,
                ),
            )
        conn.commit()
    finally:
        conn.close()


@app.post("/api/nesl/execute", tags=["NeSL"])
async def nesl_execute(req: Optional[NeslFilingRequest] = None):
    """
    File the latest generated agreement with the NeSL registry.

    In dev (`NESL_USE_MOCK=true`, default) this sleeps `NESL_MOCK_DELAY_SEC`
    seconds and returns a fake `NESL-XXXXXXXXXXXX` transaction id. In
    production it routes to `ProductionNeslClient`, which is a stub until
    NeSL sandbox credentials + spec are wired in.
    """
    import asyncio
    import logging
    logger = logging.getLogger("uvicorn.error")

    payload = req or NeslFilingRequest()

    async def _audit_failure(error_message: str) -> None:
        try:
            await asyncio.to_thread(_persist_nesl_failure, payload, error_message)
        except Exception:
            logger.exception("Failed to persist NeSL failure audit row")

    try:
        client = get_nesl_client()
        result = await client.file(payload)
    except NotImplementedError as e:
        logger.warning("NeSL production client not configured: %s", e)
        body = {
            "success": False,
            "error": "NeSL production client not configured",
            "detail": str(e) if not IS_PRODUCTION else "Configuration error",
        }
        await _audit_failure(f"{body['error']}: {e}")
        return JSONResponse(status_code=502, content=body)
    except Exception as e:
        logger.exception("NeSL filing failed")
        body = {
            "success": False,
            "error": "NeSL filing failed",
            "detail": str(e) if not IS_PRODUCTION else "An unexpected error occurred",
        }
        await _audit_failure(f"{body['error']}: {e}")
        return JSONResponse(status_code=502, content=body)

    try:
        await asyncio.to_thread(_persist_nesl_filing, result, payload)
    except Exception:
        # Persistence failure must not hide a successful upstream filing.
        logger.exception("NeSL filing persisted to upstream but DB write failed")

    return result.model_dump(mode="json")


if __name__ == "__main__":

    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
