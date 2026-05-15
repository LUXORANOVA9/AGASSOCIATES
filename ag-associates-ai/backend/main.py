import uuid
import asyncio
import logging
import os
import tempfile
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector as _register_vector
from config import (
    get_database_url,
    LOG_LEVEL,
    NESL_MOCK_DELAY_SEC,
)
from agents import process_rental_request
from accountant_agent import accountant_agent
from vyasa_agent import vyasa_agent
from executor_agent import executor_agent
from auth import get_current_user

logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))

app = FastAPI(
    title="AG Associates AI Backend",
    description="Legal document generation API with RAG-powered templates",
    version="1.0.0",
)


# Generate unique Request ID for telemetry
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = uuid.uuid4().hex
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# Step 5: Structured Error Responses
class APIError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code


@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "requestId": getattr(request.state, "request_id", "unknown"),
            }
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(
        f"System Error: {str(exc)} | Request ID: {getattr(request.state, 'request_id', 'unknown')}"
    )
    # Don't expose internal details
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "SYSTEM_ERROR",
                "message": "An internal system error occurred. Please try again later.",
                "requestId": getattr(request.state, "request_id", "unknown"),
            }
        },
    )


# CORS — configured via CORS_ALLOWED_ORIGINS env var (comma-separated).
# Refuse wildcard origin when credentials are enabled for security.
_default_cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
_extra_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

# Refuse the wildcard origin: combined with allow_credentials=True it would
# effectively allow any site to make authenticated cross-origin calls.
if "*" in _extra_cors_origins:
    raise RuntimeError(
        "CORS_ALLOW_ORIGINS='*' is not permitted because credentials are "
        "enabled. List explicit origins instead."
    )

_allowed_origins = sorted(set(_default_cors_origins + _extra_cors_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class LegalQueryRequest(BaseModel):
    case_details: Dict[str, Any]
    query: str


class CaseStateRequest(BaseModel):
    case_state: Dict[str, Any]
    timestamp: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class WebhookPayload(BaseModel):
    message: str
    sender: str
    timestamp: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AgreementRequest(BaseModel):
    """Request payload for generating a rental agreement"""

    raw_input: str
    sender: Optional[str] = "api_user"


class WorkflowResponse(BaseModel):
    """Response from the agent workflow"""

    success: bool
    document_path: Optional[str] = None
    audit_passed: Optional[bool] = None
    extracted_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class DashboardStatus(BaseModel):
    total_templates: int
    active_agents: int
    system_status: str
    recent_activities: Optional[List[Dict[str, Any]]] = None


def get_db_connection():
    """Create database connection with pgvector support"""
    conn = psycopg2.connect(get_database_url(), cursor_factory=RealDictCursor)
    _register_vector(conn)
    return conn


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ag-associates-ai"}


@app.post("/webhook/whatsapp")
async def whatsapp_webhook(payload: WebhookPayload):
    """
    Webhook endpoint for WhatsApp messages via n8n
    Receives incoming messages and triggers agent workflows
    """
    try:
        # Log the incoming webhook
        print(
            f"Received WhatsApp message from {payload.sender}: {payload.message[:100]}..."
        )

        # Trigger LangGraph agent workflow in a threadpool so we don't
        # block the asyncio event loop on synchronous LLM/DB calls.
        result = await asyncio.to_thread(
            process_rental_request,
            raw_input=payload.message,
            sender=payload.sender,
        )

        return {
            "status": "processed",
            "message_id": "msg_123456",
            "sender": payload.sender,
            "workflow_result": result,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Webhook processing failed: {str(e)}"
        )


@app.post("/api/generate-agreement")
async def generate_agreement_api(
    request: AgreementRequest, user: dict = Depends(get_current_user)
):
    """
    Direct API endpoint to generate an agreement without going through WhatsApp.
    Secured with Supabase Auth JWT.

    This is the main entry point for triggering the Aisha -> Drafter -> Auditor pipeline
    """
    try:
        # Offload the blocking agent workflow to a worker thread to keep
        # the FastAPI event loop responsive under concurrent load.
        result = await asyncio.to_thread(
            process_rental_request,
            raw_input=request.raw_input,
            sender=request.sender,
        )

        return WorkflowResponse(
            success=result.get("success", False),
            document_path=result.get("document_path"),
            audit_passed=result.get("audit_passed"),
            extracted_data=result.get("extracted_data"),
            error=result.get("error"),
        )
    except Exception as e:
        return WorkflowResponse(success=False, error=str(e))


def _fetch_total_templates() -> int:
    """Helper to fetch total templates count from DB synchronously."""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT COUNT(*) as count FROM legal_templates")
            return cur.fetchone()["count"]
        finally:
            cur.close()
    finally:
        if conn is not None:
            conn.close()


@app.get("/dashboard/status", response_model=DashboardStatus)
async def dashboard_status():
    """
    Real-time status endpoint for the frontend dashboard
    Shows agent activity, template count, and system health
    """
    try:
        # Offload the blocking database query to a threadpool
        total_templates = await asyncio.to_thread(_fetch_total_templates)

        # Mock active agents (will be replaced with actual LangGraph state)
        active_agents = 3

        return DashboardStatus(
            total_templates=total_templates,
            active_agents=active_agents,
            system_status="operational",
            recent_activities=[
                {
                    "action": "template_loaded",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "details": "Maharashtra Rent Agreement loaded",
                },
                {
                    "action": "embedding_generated",
                    "timestamp": "2024-01-15T10:31:00Z",
                    "details": "Vector embedding created for template #1",
                },
            ],
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Dashboard status fetch failed: {str(e)}"
        )


def _fetch_templates(
    template_type: Optional[str] = None, language: Optional[str] = None
):
    """Helper to fetch templates from DB synchronously."""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            query = "SELECT id, title, template_type, jurisdiction, language, created_at FROM legal_templates WHERE 1=1"
            params = []

            if template_type:
                query += " AND template_type = %s"
                params.append(template_type)

            if language:
                query += " AND language = %s"
                params.append(language)

            cur.execute(query, params)
            return cur.fetchall()
        finally:
            cur.close()
    finally:
        if conn is not None:
            conn.close()


@app.get("/templates")
async def list_templates(
    template_type: Optional[str] = None, language: Optional[str] = None
):
    """List available legal templates with optional filtering"""
    try:
        templates = await asyncio.to_thread(_fetch_templates, template_type, language)
        return {"templates": templates}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Template listing failed: {str(e)}"
        )


@app.post("/api/nesl/execute")
async def nesl_execute(user: dict = Depends(get_current_user)):
    """
    Mock NeSL (National e-Services Ltd) filing endpoint
    Secured with Supabase Auth JWT.
    """
    try:
        # Simulate processing delay (configurable via NESL_MOCK_DELAY_SEC).
        await asyncio.sleep(NESL_MOCK_DELAY_SEC)

        # Generate a random transaction ID
        transaction_id = f"NESL-{uuid.uuid4().hex[:12].upper()}"

        return {
            "success": True,
            "transaction_id": transaction_id,
            "status": "filed",
            "message": "Document successfully filed with NeSL registry",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NeSL filing failed: {str(e)}")


@app.post("/api/reconcile-statement")
async def reconcile_bank_statement(
    file: UploadFile = File(...), user: dict = Depends(get_current_user)
):
    """
    Agent 6 (Accountant): Ingest bank statement PDF, extract text,
    parse UTRs and loan numbers using LLM, and return structured transactions.
    Secured with Supabase Auth JWT.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        # Save uploaded file to a temporary location
        _upload_dir = os.getenv("UPLOAD_TEMP_DIR", tempfile.gettempdir())
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", dir=_upload_dir) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        # Run the accountant agent in a separate thread since PDF parsing is blocking
        result = await asyncio.to_thread(accountant_agent.reconcile, temp_path)

        # Clean up temp file
        os.unlink(temp_path)

        if not result.get("success"):
            raise HTTPException(
                status_code=500, detail=result.get("error", "Unknown parsing error")
            )

        return result

    except Exception as e:
        logging.error(f"Reconciliation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/research")
async def vyasa_research(
    request: LegalQueryRequest, user: dict = Depends(get_current_user)
):
    """
    Agent 2 (Vyasa): Generate legal opinion based on case facts.
    Secured with Supabase Auth JWT.
    """
    try:
        result = await asyncio.to_thread(
            vyasa_agent.generate_legal_opinion, request.case_details, request.query
        )
        if not result.get("success"):
            raise HTTPException(
                status_code=500, detail=result.get("error", "Unknown research error")
            )
        return result
    except Exception as e:
        logging.error(f"Vyasa research error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/execute")
async def executor_action(
    request: CaseStateRequest, user: dict = Depends(get_current_user)
):
    """
    Agent 4 (Executor): Determine the next workflow action for a case.
    Secured with Supabase Auth JWT.
    """
    try:
        result = await asyncio.to_thread(
            executor_agent.determine_next_action, request.case_state
        )
        if not result.get("success"):
            raise HTTPException(
                status_code=500, detail=result.get("error", "Unknown executor error")
            )
        return result
    except Exception as e:
        logging.error(f"Executor routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    from config import API_HOST, API_PORT

    uvicorn.run(app, host=API_HOST, port=API_PORT)

class CaseStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

@app.get("/api/cases")
async def list_cases(user: dict = Depends(get_current_user)):
    """Mock endpoint to return cases for the Kanban board"""
    cases = [
        {"id": "c1", "case_number": "AGA-2024-00123", "borrower_name": "Rahul Patil", "loan_amount": 5000000, "status": "RECEIVED", "case_type": "TITLE_SEARCH", "created_at": "2024-05-01T10:00:00Z"},
        {"id": "c2", "case_number": "AGA-2024-00124", "borrower_name": "Sneha Sharma", "loan_amount": 7500000, "status": "ASSIGNED", "case_type": "MORTGAGE", "created_at": "2024-05-02T11:30:00Z"},
        {"id": "c3", "case_number": "AGA-2024-00125", "borrower_name": "Amit Desai", "loan_amount": 12000000, "status": "IN_PROGRESS", "case_type": "FRANKING", "created_at": "2024-05-03T09:15:00Z"},
        {"id": "c4", "case_number": "AGA-2024-00126", "borrower_name": "Priya Singh", "loan_amount": 3500000, "status": "QUALITY_CHECK", "case_type": "TITLE_SEARCH", "created_at": "2024-05-04T14:20:00Z"},
        {"id": "c5", "case_number": "AGA-2024-00127", "borrower_name": "Vikram Joshi", "loan_amount": 9000000, "status": "REGISTERED", "case_type": "MORTGAGE", "created_at": "2024-05-05T16:45:00Z"}
    ]
    return cases

@app.patch("/api/cases/{case_id}")
async def update_case_status(case_id: str, payload: CaseStatusUpdate, user: dict = Depends(get_current_user)):
    """Mock endpoint to update case status (e.g. from Kanban board)"""
    # In a real app, this would update the database
    return {"id": case_id, "status": payload.status, "message": "Status updated successfully"}

@app.put("/api/cases/{case_id}/status")
async def put_case_status(case_id: str, payload: CaseStatusUpdate, user: dict = Depends(get_current_user)):
    """Mock endpoint for field app to update case status"""
    return {"id": case_id, "status": payload.status, "message": "Status updated successfully"}
