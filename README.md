<p align="center">
  <h1 align="center">⚖️ AG Associates</h1>
  <p align="center">
    <strong>AI-Powered Legal Operations Platform for India</strong>
  </p>
  <p align="center">
    Automate rental agreements via WhatsApp · Manage cases end-to-end · Collaborate in real time
  </p>
</p>

<p align="center">
  <a href="https://github.com/LUXORANOVA9/AGASSOCIATES/actions"><img src="https://img.shields.io/github/actions/workflow/status/LUXORANOVA9/AGASSOCIATES/sonarcloud.yml?style=flat-square&label=CI" alt="CI Status"></a>
  <a href="https://github.com/LUXORANOVA9/AGASSOCIATES/blob/main/LICENSE"><img src="https://img.shields.io/github/license/LUXORANOVA9/AGASSOCIATES?style=flat-square" alt="License"></a>
  <a href="https://github.com/LUXORANOVA9/AGASSOCIATES/pulls"><img src="https://img.shields.io/github/issues-pr/LUXORANOVA9/AGASSOCIATES?style=flat-square&label=PRs" alt="PRs"></a>
  <a href="https://github.com/LUXORANOVA9/AGASSOCIATES/stargazers"><img src="https://img.shields.io/github/stars/LUXORANOVA9/AGASSOCIATES?style=flat-square" alt="Stars"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-key-features">Features</a> ·
  <a href="#-api-reference">API</a> ·
  <a href="#-contributing">Contributing</a> ·
  <a href="./CLAUDE.md">Dev Guide</a>
</p>

---

## What is AG Associates?

AG Associates is a **full-stack legal operations platform** designed for Indian law firms handling property registrations, title searches, and rental agreements at scale. It combines two powerful systems:

| System | Purpose | Stack |
|--------|---------|-------|
| **AG AI Pipeline** (`ag-associates-ai/`) | WhatsApp → AI Agent → Legal Document → PDF → NeSL Filing | FastAPI · LangGraph · pgvector · vLLM |
| **AG Platform** (`ag-platform/`) | Case management, bank portal, collaboration, document vault | Next.js · Supabase · Turborepo · Gemini |

> 💡 **Think of it as:** Dify's agentic workflows meets Supabase's developer platform — purpose-built for Indian legal operations.

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         AG Associates                            │
│                                                                  │
│  ┌─────────────────────────┐   ┌──────────────────────────────┐  │
│  │     AG AI Pipeline      │   │        AG Platform           │  │
│  │                         │   │                              │  │
│  │  WhatsApp ──→ n8n       │   │  Next.js Dashboard           │  │
│  │       │                 │   │  Bank Portal (RLS-isolated)  │  │
│  │       ▼                 │   │  Case State Machine          │  │
│  │  ┌──────────┐          │   │  Document Vault              │  │
│  │  │  Aisha   │ Intake    │   │  Real-time Collaboration     │  │
│  │  └────┬─────┘          │   │                              │  │
│  │       ▼                 │   │  ┌────────────────────────┐  │  │
│  │  ┌──────────┐          │   │  │  Gemini AI              │  │  │
│  │  │ Drafter  │ RAG+LLM  │◄──┼──│  • Email drafting       │  │  │
│  │  └────┬─────┘          │   │  │  • Semantic search      │  │  │
│  │       ▼                 │   │  │  • Smart suggestions    │  │  │
│  │  ┌──────────┐          │   │  └────────────────────────┘  │  │
│  │  │ Auditor  │ QA Loop  │   │                              │  │
│  │  └────┬─────┘          │   └──────────────────────────────┘  │
│  │       ▼                 │                                     │
│  │  PDF → NeSL Filing      │         Supabase (PostgreSQL)       │
│  └─────────────────────────┘         + pgvector · RLS · Auth     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🤖 AI Document Pipeline (`ag-associates-ai`)

| Feature | Description |
|---------|-------------|
| **3-Node Agent Workflow** | Aisha (intake) → Drafter (RAG + LLM) → Auditor (compliance QA) via LangGraph |
| **RAG Template Retrieval** | pgvector similarity search with SentenceTransformer embeddings (384-dim) |
| **Multi-Language Support** | English, Marathi, Hindi rental agreement templates |
| **PDF Generation** | Production-quality PDFs via ReportLab with Indian legal formatting |
| **WhatsApp Integration** | End-to-end via n8n webhooks → FastAPI → LangGraph → response |
| **NeSL Mock Filing** | Simulated government registry filing endpoint |

### 📋 Legal Operations Platform (`ag-platform`)

| Feature | Description |
|---------|-------------|
| **Case State Machine** | 10-state workflow: RECEIVED → ASSIGNED → ... → INVOICED → CLOSED |
| **Role-Based Access** | PRINCIPAL · ADVOCATE · EXECUTIVE · CLERK · BANK_VIEWER |
| **Multi-Tenancy** | `org_id` everywhere with Supabase RLS enforcement |
| **Real-Time Collaboration** | Live presence, comment threads, notification bell, task boards |
| **Document Vault** | Upload, preview, versioning with signed URLs |
| **Bank Portal** | Isolated read-only view for bank clients (ICICI can't see Kotak cases) |
| **AI Features** | Gemini-powered email drafting, project briefs, semantic search |
| **SLA Tracking** | Automated deadline monitoring with WhatsApp alerts |

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Python 3.10+ (for AI pipeline)
- Node.js 18+ (for platform frontend)
- GPU with CUDA (optional — for local vLLM)

### Option 1: AI Pipeline Only

```bash
# 1. Clone & configure
git clone https://github.com/LUXORANOVA9/AGASSOCIATES.git
cd AGASSOCIATES/ag-associates-ai
cp .env.example .env

# 2. Start PostgreSQL + n8n
docker-compose up -d

# 3. Set up Python backend
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

# 4. Generate embeddings & start
python generate_embeddings.py
python main.py                  # API at http://localhost:8001
```

### Option 2: Full Platform

```bash
# 1. Install dependencies (from repo root)
cd ag-platform
npm install

# 2. Configure Supabase
cp .env.example .env            # Add your Supabase URL & anon key

# 3. Run migrations
# Apply SQL files from supabase/migrations/ to your Supabase project

# 4. Start dev server
npm run dev
```

---

## 📡 API Reference

### Health Check
```http
GET /health
```
```json
{ "status": "healthy", "service": "ag-associates-ai" }
```

### Generate Agreement (Main Endpoint)
```http
POST /api/generate-agreement
Content-Type: application/json

{
  "raw_input": "Create rent agreement for Flat 301, Shivaji Nagar, Pune. Tenant: Raj Sharma, Landlord: Priya Patel, Rent: 25000, Duration: 11 months, Deposit: 75000",
  "sender": "api_user"
}
```

### WhatsApp Webhook
```http
POST /webhook/whatsapp
Content-Type: application/json

{ "message": "I need a rent agreement", "sender": "+919876543210" }
```

### Dashboard Status
```http
GET /dashboard/status
```

### List Templates
```http
GET /templates?template_type=rent_agreement&language=en
```

### NeSL Filing (Mock)
```http
POST /api/nesl/execute
```

---

## 📁 Repository Structure

```
AGASSOCIATES/
│
├── ag-associates-ai/              # 🤖 AI Document Pipeline
│   ├── backend/
│   │   ├── agents.py              #   LangGraph 3-node pipeline
│   │   ├── main.py                #   FastAPI endpoints
│   │   ├── config.py              #   Environment configuration
│   │   ├── pdf_generator.py       #   ReportLab PDF output
│   │   ├── generate_embeddings.py #   SentenceTransformer batch embedder
│   │   └── requirements.txt       #   Python dependencies
│   ├── frontend/                  #   Next.js 15 dashboard
│   ├── database/
│   │   └── init.sql               #   PostgreSQL + pgvector schema
│   └── docker-compose.yml         #   PostgreSQL + n8n services
│
├── ag-platform/                   # 📋 Legal Operations Platform
│   ├── packages/
│   │   ├── ai/                    #   Gemini AI utilities
│   │   ├── db/                    #   Drizzle ORM schemas
│   │   ├── types/                 #   Shared TypeScript interfaces
│   │   └── ui/                    #   Shared shadcn/ui components
│   ├── src/
│   │   ├── components/            #   React components (admin, AI, bank, collaboration)
│   │   ├── server/                #   Express backend + AI router
│   │   └── hooks/                 #   React hooks (presence, notifications)
│   ├── supabase/migrations/       #   Database migrations
│   └── server.ts                  #   Express entry point
│
├── CLAUDE.md                      # 📖 Developer guidelines & gotchas
├── SECURITY.md                    # 🔒 Security policy
└── content/                       # 📄 Content assets
```

---

## ⚙️ Environment Variables

The project uses **three separate `.env` files** for isolation:

| File | Purpose | Key Variables |
|------|---------|---------------|
| `ag-associates-ai/.env` | Docker Compose (Postgres, n8n, WhatsApp) | `POSTGRES_*`, `N8N_*`, `WHATSAPP_*` |
| `ag-associates-ai/backend/.env` | Python backend config | `LLM_BASE_URL`, `EMBEDDING_MODEL_NAME`, `DATABASE_*` |
| `ag-platform/.env` | Supabase + platform config | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY` |

> See each directory's `.env.example` for all available options with descriptions.

---

## 🗺 Roadmap

- [x] **AI Pipeline** — LangGraph agents, RAG retrieval, PDF generation
- [x] **Case Management** — Full state machine with SLA tracking
- [x] **Bank Portal** — Isolated read-only views with RLS
- [x] **Collaboration** — Real-time presence, comments, task boards
- [x] **Document Vault** — Upload, preview, versioning
- [ ] **Unified Auth** — Single Supabase Auth across both systems
- [ ] **Pipeline Integration** — Case state machine triggers AI agreement generation
- [ ] **Mobile App** — React Native field app for executives
- [ ] **Production NeSL** — Live government registry filing
- [ ] **Multi-firm SaaS** — White-label for other law firms

---

## 🔒 Security

- **Data Sovereignty**: Deployed in `ap-south-1` (Mumbai) for Indian banking data compliance
- **Row-Level Security**: Supabase RLS enforces tenant and bank isolation at the database level
- **Document Vault**: Private buckets with 60-second signed URLs
- **Audit Logging**: Every case state transition logged to immutable `case_audit_logs`

For vulnerability reports, see [SECURITY.md](./SECURITY.md) or email [security@agassociates.com](mailto:security@agassociates.com).

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

Please read [CLAUDE.md](./CLAUDE.md) for development guidelines, architectural decisions, and known gotchas.

---

## 📜 License

This project is proprietary software owned by AG Associates.

See [LICENSE](./LICENSE) for details.

---

<p align="center">
  <sub>Built with ❤️ in Pune, India · Powered by LangGraph, Supabase & Gemini</sub>
</p>