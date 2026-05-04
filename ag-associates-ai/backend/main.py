import uuid
import asyncio
import logging
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
import tempfile
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector as _register_vector
from config import (
    get_database_url,
    CORS_ALLOWED_ORIGINS,
    LOG_LEVEL,
    NESL_MOCK_DELAY_SEC,
)
from agents import process_rental_request
from accountant_agent import accountant_agent
from auth import get_current_user

logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))

app = FastAPI(
    title="AG Associates AI Backend",
    description="Legal document generation API with RAG-powered templates",
    version="1.0.0"
)

# CORS — configured via CORS_ALLOWED_ORIGINS env var (comma-separated, or `*`).
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    conn = psycopg2.connect(
        get_database_url(),
        cursor_factory=RealDictCursor
    )
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
        print(f"Received WhatsApp message from {payload.sender}: {payload.message[:100]}...")
        
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
            "workflow_result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")


@app.post("/api/generate-agreement")
async def generate_agreement_api(request: AgreementRequest, user: dict = Depends(get_current_user)):
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
            error=result.get("error")
        )
    except Exception as e:
        return WorkflowResponse(
            success=False,
            error=str(e)
        )

@app.get("/dashboard/status", response_model=DashboardStatus)
async def dashboard_status():
    """
    Real-time status endpoint for the frontend dashboard
    Shows agent activity, template count, and system health
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            # Get total templates count
            cur.execute("SELECT COUNT(*) as count FROM legal_templates")
            total_templates = cur.fetchone()['count']
        finally:
            cur.close()
        
        # Mock active agents (will be replaced with actual LangGraph state)
        active_agents = 3
        
        return DashboardStatus(
            total_templates=total_templates,
            active_agents=active_agents,
            system_status="operational",
            recent_activities=[
                {"action": "template_loaded", "timestamp": "2024-01-15T10:30:00Z", "details": "Maharashtra Rent Agreement loaded"},
                {"action": "embedding_generated", "timestamp": "2024-01-15T10:31:00Z", "details": "Vector embedding created for template #1"}
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard status fetch failed: {str(e)}")
    finally:
        if conn is not None:
            conn.close()

@app.get("/templates")
async def list_templates(template_type: Optional[str] = None, language: Optional[str] = None):
    """List available legal templates with optional filtering"""
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
            templates = cur.fetchall()
        finally:
            cur.close()
        
        return {"templates": templates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template listing failed: {str(e)}")
    finally:
        if conn is not None:
            conn.close()


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
            "message": "Document successfully filed with NeSL registry"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NeSL filing failed: {str(e)}")

@app.post("/api/reconcile-statement")
async def reconcile_bank_statement(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """
    Agent 6 (Accountant): Ingest bank statement PDF, extract text,
    parse UTRs and loan numbers using LLM, and return structured transactions.
    Secured with Supabase Auth JWT.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        # Save uploaded file to a temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
            
        # Run the accountant agent in a separate thread since PDF parsing is blocking
        result = await asyncio.to_thread(accountant_agent.reconcile, temp_path)
        
        # Clean up temp file
        os.unlink(temp_path)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown parsing error"))
            
        return result
        
    except Exception as e:
        logging.error(f"Reconciliation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    from config import API_HOST, API_PORT
    uvicorn.run(app, host=API_HOST, port=API_PORT)
