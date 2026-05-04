import os
import uuid
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
import numpy as np
from config import get_database_url, EMBEDDING_DIMENSION
from agents import process_rental_request

app = FastAPI(
    title="AG Associates AI Backend",
    description="Legal document generation API with RAG-powered templates",
    version="1.0.0"
)

# Allow the dashboard frontend (and any additional origins listed in
# CORS_ALLOW_ORIGINS) to call this API from the browser. Without this the
# Next.js dashboard at http://localhost:3000 cannot reach the API and every
# request fails with a CORS preflight error.
_default_cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_cors_env = os.getenv("CORS_ALLOW_ORIGINS", "")
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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Register pgvector
register_vector()

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
async def generate_agreement(request: AgreementRequest) -> WorkflowResponse:
    """
    API endpoint to generate a rental agreement using the agent workflow
    
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
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get total templates count
        cur.execute("SELECT COUNT(*) as count FROM legal_templates")
        total_templates = cur.fetchone()['count']
        
        cur.close()
        conn.close()
        
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

@app.get("/templates")
async def list_templates(template_type: Optional[str] = None, language: Optional[str] = None):
    """List available legal templates with optional filtering"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
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
        
        cur.close()
        conn.close()
        
        return {"templates": templates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template listing failed: {str(e)}")


@app.post("/api/nesl/execute")
async def nesl_execute():
    """
    Mock NeSL (National e-Services Ltd) filing endpoint
    Simulates filing the generated agreement with the government registry
    
    Returns a transaction ID after a simulated delay
    """
    try:
        # Simulate processing delay (3 seconds as per roadmap)
        await asyncio.sleep(3)
        
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


if __name__ == "__main__":
    import uvicorn
    from config import API_HOST, API_PORT
    uvicorn.run(app, host=API_HOST, port=API_PORT)
