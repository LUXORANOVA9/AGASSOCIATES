# AG Associates AI — Document Processing Pipeline

> The AI engine of [AG Associates](../README.md), a property law firm and Panel Advocate for major Indian banks and NBFCs. This pipeline processes legal documents — Title Reports, Legal Scrutiny Reports, NOI documents, Agreement drafts — through a multi-agent workflow powered by LangGraph.

---

## How It Works

```
Incoming Case (WhatsApp / Bank Portal / API)
       │
       ▼
  n8n Webhook ──→ FastAPI /webhook/whatsapp
                        │
                        ▼
                ┌───────────────┐
                │  Aisha        │  Extracts: case type, parties,
                │  (Intake)     │  property details, bank, amounts
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │  Drafter      │  pgvector → best legal template
                │  (RAG + LLM)  │  LLM fills template with case data
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │  Auditor      │  Compliance check → pass or revise
                │  (QA Loop)    │  Max 3 revision cycles
                └───────┬───────┘
                        │
                        ▼
               PDF (ReportLab) → Document Vault
```

### Full Agent Roster

| Agent | Role | Current Status |
|-------|------|---------------|
| **Aisha** | Intake & data extraction | ✅ Implemented |
| **Vyasa** | Research & legal opinion | ✅ Implemented |
| **Drafter** | Report & document generation | ✅ Implemented |
| **Executor** | Workflow triggers & field assignment | ✅ Implemented |
| **Auditor** | Compliance verification | ✅ Implemented |
| **Accountant** | Bank statement reconciliation | ✅ Implemented |

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **API** | FastAPI | Async endpoints, CORS, Pydantic validation |
| **Orchestration** | LangGraph | Multi-agent stateful pipeline |
| **LLM** | vLLM (Qwen 2.5-7B) | Document drafting & compliance auditing |
| **Embeddings** | SentenceTransformer (`all-MiniLM-L6-v2`) | 384-dim vectors for template retrieval |
| **Vector DB** | PostgreSQL + pgvector | Similarity search on legal templates |
| **PDF** | ReportLab | Indian legal document formatting |
| **Webhooks** | n8n | WhatsApp Business API integration |
| **Infra** | Docker Compose | PostgreSQL + n8n containers |

## Quick Start

```bash
# 1. Infrastructure
cp .env.example .env
docker-compose up -d

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# 3. Generate embeddings (one-time)
python generate_embeddings.py

# 4. Start (optional: start vLLM on port 8000 first)
python main.py    # → http://localhost:8001
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/webhook/whatsapp` | WhatsApp/n8n message intake |
| `POST` | `/api/generate-agreement` | Direct document generation |
| `GET` | `/dashboard/status` | System health, template count |
| `GET` | `/templates` | List templates (filterable by type, language) |
| `POST` | `/api/nesl/execute` | Mock NeSL government filing |

## Environment Variables

See [`backend/.env.example`](./backend/.env.example) for the full list. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | `http://localhost:8000/v1` | vLLM OpenAI-compatible endpoint |
| `LLM_MODEL_NAME` | `qwen2.5-7b-instruct` | Model served by vLLM |
| `EMBEDDING_MODEL_NAME` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `EMBEDDING_DIMENSION` | `384` | Must match model output & `init.sql` |
| `DATABASE_HOST` | `localhost` | PostgreSQL host |
| `OUTPUT_DIR` | `../output` (relative) | Generated PDF/MD output directory |

## Development

See [`CLAUDE.md`](../CLAUDE.md) for architecture details, conventions, and known gotchas.
