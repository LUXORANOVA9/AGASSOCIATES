from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
import numpy as np
from config import get_database_url, EMBEDDING_DIMENSION

app = FastAPI(
    title="AG Associates AI Backend",
    description="Legal document generation API with RAG-powered templates",
    version="1.0.0"
)

# Register pgvector
register_vector()

class WebhookPayload(BaseModel):
    message: str
    sender: str
    timestamp: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

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
        
        # TODO: Trigger LangGraph agent workflow here
        # For now, just acknowledge receipt
        return {
            "status": "received",
            "message_id": "msg_123456",
            "sender": payload.sender
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

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

if __name__ == "__main__":
    import uvicorn
    from config import API_HOST, API_PORT
    uvicorn.run(app, host=API_HOST, port=API_PORT)
