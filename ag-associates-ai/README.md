# AG Associates AI — Document Generation Pipeline

> The AI brain of [AG Associates](../README.md). Receives natural-language requests via WhatsApp, extracts structured data, retrieves relevant legal templates via RAG, drafts documents with an LLM, audits them for compliance, and outputs production-ready PDFs.

---

## How It Works

```
WhatsApp Message
       │
       ▼
  n8n Webhook ──→ FastAPI /webhook/whatsapp
                        │
                        ▼
                ┌───────────────┐
                │  Aisha Node   │  Extracts: tenant, landlord, rent,
                │  (Intake)     │  address, duration, deposit
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │ Drafter Node  │  pgvector similarity search → top template
                │ (RAG + LLM)   │  LLM fills template with extracted data
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │ Auditor Node  │  Compliance check → pass or revise
                │ (QA Loop)     │  Max 3 revision cycles
                └───────┬───────┘
                        │
                        ▼
                  PDF (ReportLab)
                        │
                        ▼
                  NeSL Filing (mock)
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **API** | FastAPI | Async endpoints, CORS, Pydantic validation |
| **Orchestration** | LangGraph | 3-node stateful agent pipeline |
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

# 3. Generate embeddings
python generate_embeddings.py

# 4. Start (optional: start vLLM on port 8000 first)
python main.py    # → http://localhost:8001
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/webhook/whatsapp` | WhatsApp message intake |
| `POST` | `/api/generate-agreement` | Direct agreement generation |
| `GET` | `/dashboard/status` | Template count, system health |
| `GET` | `/templates` | List templates (filterable) |
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

See [`CLAUDE.md`](../CLAUDE.md) in the repo root for architecture details, conventions, and known gotchas.
