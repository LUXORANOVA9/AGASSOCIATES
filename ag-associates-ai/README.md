# AG Associates AI - Legal Document Generation System

A microservices-based AI system for automated legal document generation with RAG-powered template retrieval.

## Architecture Overview

### Components

1. **The Brain (Local LLM)**: vLLM serving Qwen 2.5 or Llama 3
2. **The Database (Memory)**: PostgreSQL with pgvector extension
3. **The Backend (Engine)**: FastAPI Python backend
4. **The Orchestrator (Agents)**: LangGraph for agent workflows
5. **The API Connector**: n8n for WhatsApp webhooks
6. **The Client Dashboard**: Next.js frontend with glassmorphism UI

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.10+
- GPU with CUDA support (for vLLM)

### Step 1: Start Infrastructure Services

```bash
cd ag-associates-ai
cp .env.example .env
docker-compose up -d
```

This starts:
- PostgreSQL with pgvector on port 5432
- n8n workflow automation on port 5678

### Step 2: Set Up Python Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

### Step 3: Initialize Database

The database is automatically initialized when you start the Docker containers. The `init.sql` script creates:
- `legal_templates` table with vector column
- Sample Maharashtra rent agreement templates (English, Marathi, Hindi)
- Vector similarity search index

### Step 4: Generate Embeddings

```bash
cd backend
python generate_embeddings.py
```

This generates vector embeddings for all templates using sentence-transformers.

### Step 5: Start FastAPI Backend

```bash
python main.py
```

The API will be available at `http://localhost:8001`

### Step 6: Set Up vLLM (Separate Terminal)

```bash
# Install vLLM
pip install vllm

# Start vLLM server with OpenAI-compatible API
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct \
    --host 0.0.0.0 \
    --port 8000
```

## API Endpoints

### Health Check
```bash
GET http://localhost:8001/health
```

### WhatsApp Webhook
```bash
POST http://localhost:8001/webhook/whatsapp
Content-Type: application/json

{
  "message": "I need a rent agreement",
  "sender": "+919876543210"
}
```

### Dashboard Status
```bash
GET http://localhost:8001/dashboard/status
```

### List Templates
```bash
GET http://localhost:8001/templates?template_type=rent_agreement&language=en
```

## Project Structure

```
ag-associates-ai/
├── .env.example              # Root compose and integration variables
├── docker-compose.yml          # Docker services configuration
├── database/
│   └── init.sql               # Database initialization script
├── backend/
│   ├── main.py                # FastAPI application with agent integration
│   ├── agents.py              # LangGraph workflow (Aisha → Drafter → Auditor)
│   ├── pdf_generator.py       # ReportLab PDF generation
│   ├── config.py              # Configuration management
│   ├── generate_embeddings.py # Embedding generation script
│   ├── requirements.txt       # Python dependencies
│   └── .env.example          # Environment variables template
├── frontend/
│   └── .env.example          # Frontend runtime variables template
├── output/                     # Generated agreements (PDF & Markdown)
├── README.md
└── LANGGRAPH_AGENTS.md        # Detailed agent documentation
```

## Environment Variables

This project uses separate environment files for compose, backend, and frontend.

### Root compose variables (`.env`)

Copy `ag-associates-ai/.env.example` to `ag-associates-ai/.env` before running Docker Compose.

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: PostgreSQL container credentials/database
- `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`: n8n basic auth credentials
- `N8N_HOST`, `WEBHOOK_URL`: n8n host and external webhook base URL
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`: WhatsApp Cloud API and webhook settings

### Backend variables (`backend/.env`)

Copy `ag-associates-ai/backend/.env.example` to `ag-associates-ai/backend/.env`.

- Database: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`
- LLM: `LLM_BASE_URL`, `LLM_MODEL_NAME`, `LLM_MOCK_MODE`
- Embeddings: `EMBEDDING_MODEL_NAME`, `EMBEDDING_DIMENSION`
- API/runtime: `API_HOST`, `API_PORT`, `CORS_ALLOWED_ORIGINS`, `LOG_LEVEL`, `OUTPUT_DIR`, `PDF_ENABLED`
- NeSL mock endpoint: `NESL_MOCK_DELAY_SEC`

### Frontend variables (`frontend/.env.local`)

Copy `ag-associates-ai/frontend/.env.example` to `ag-associates-ai/frontend/.env.local`.

- `NEXT_PUBLIC_API_URL`: Browser-facing API URL
- `API_URL`: Server-side API URL for Next.js route handlers/components

## Development Roadmap

### Day 1: Infrastructure & "The Brain" ✅
- [x] Docker infrastructure setup
- [x] PostgreSQL with pgvector
- [x] Database schema and sample data
- [x] FastAPI skeleton with webhook endpoints
- [x] Embedding generation script

### Day 2: Agent Workflows ✅ COMPLETE
- [x] LangGraph agent implementation (Aisha → Drafter → Auditor)
- [x] RAG template retrieval integration
- [x] PDF generation with ReportLab
- [x] Conditional routing (audit pass/fail with revision loop)
- [x] Multi-language support (English, Marathi, Hindi)
- [x] vLLM integration for document generation
- [x] New API endpoint: `/api/generate-agreement`

### Day 3: Frontend Dashboard
- [ ] Next.js application setup
- [ ] Real-time status dashboard
- [ ] Glassmorphism UI design
- [ ] Agent activity visualization
- [ ] Document download functionality

## License

Proprietary - AG Associates
