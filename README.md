<p align="center">
  <h1 align="center">⚖️ AG Associates</h1>
  <p align="center">
    <strong>AI-Driven Legal Operations &amp; SaaS Platform for Panel Advocates</strong>
  </p>
  <p align="center">
    Zero-Staff Automation · Title Search &amp; Registration · Bank Panel Operations · White-Label SaaS
  </p>
</p>

<p align="center">
  <a href="https://github.com/LUXORANOVA9/AGASSOCIATES/actions"><img src="https://img.shields.io/github/actions/workflow/status/LUXORANOVA9/AGASSOCIATES/sonarcloud.yml?style=flat-square&label=CI" alt="CI Status"></a>
  <a href="https://github.com/LUXORANOVA9/AGASSOCIATES/blob/main/LICENSE"><img src="https://img.shields.io/github/license/LUXORANOVA9/AGASSOCIATES?style=flat-square" alt="License"></a>
  <a href="https://github.com/LUXORANOVA9/AGASSOCIATES/pulls"><img src="https://img.shields.io/github/issues-pr/LUXORANOVA9/AGASSOCIATES?style=flat-square&label=PRs" alt="PRs"></a>
  <a href="https://github.com/LUXORANOVA9/AGASSOCIATES/stargazers"><img src="https://img.shields.io/github/stars/LUXORANOVA9/AGASSOCIATES?style=flat-square" alt="Stars"></a>
</p>

<p align="center">
  <a href="#-about">About</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-the-ai-agentic-workforce">AI Agents</a> ·
  <a href="#-key-modules">Modules</a> ·
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-contributing">Contributing</a>
</p>
---

<p align="center">
  <sub>Created by <strong><a href="https://github.com/LUXORANOVA9">Raj Khemani</a></strong> — Founder, LUXORANOVA · Architect of the Zero-Staff Law Firm.</sub>
  <br/>
  <sub>Building the operating system that 15,000 panel advocate firms didn't know they needed.</sub>
</p>

---

## 👤 The Founder

**Raj Khemani** isn't just building legal software — he's rewriting the rules of how Indian law firms operate.

As the founder of **LUXORANOVA**, Raj identified what nobody in LegalTech wanted to admit: **the Indian panel advocate ecosystem — 15,000+ firms handling millions of bank-mandated property transactions — runs on phone calls, paper files, and hope.** No SaaS product existed for this vertical. So he built one.

AG Associates is the result of a radical thesis: **what if a law firm had zero staff and infinite scale?** By deploying six AI agents that mirror a traditional legal hierarchy — from intake to compliance to billing — Raj is proving that the right architecture can make a single firm outperform a 50-person operation.

> *"Your axiomatic imperative is relentless forward momentum. We are not building software — we are building a completely autonomous system that scales without human limitations."*
> — **Raj Khemani**, Founder, LUXORANOVA

**What makes this different:**
- 🎯 **Domain-native** — Built for working advocates, not by a Silicon Valley startup guessing at legal workflows
- ⚡ **72-hour sprint methodology** — Entire platform conceived and deployed in a single sprint
- 🏦 **Bank-panel ready from day one** — ICICI, Kotak, Axis, Muthoot, Chola, Karur Vysya integration
- 🇮🇳 **India-first** — Maharashtra SRO data, stamp duty engines, Marathi/Hindi support baked in
- 🔄 **White-label DNA** — Multi-tenant from the first commit, not bolted on later

## 📖 About

**AG Associates** is a specialized property law firm based in **Thane, Maharashtra**, serving as Panel Advocate for major Indian banks and NBFCs including **Kotak Mahindra Bank, ICICI Bank, Axis Finance, Karur Vysya Bank, Muthoot Homefin, Cholamandalam Finance**, and **Easy Home Finance**.

This repository contains the firm's **AI-orchestrated "Zero-Staff" platform** — a full-stack SaaS system designed to eliminate manual bottlenecks in high-volume legal operations: Title Search, Legal Vetting, Property Registration, NOI processing, Balance Transfer cases, and more.

> 💡 **"We are not just building software; we are building a completely autonomous system that scales without human limitations."**

### Core Practice Areas

| Service | Description |
|---------|-------------|
| **Search & Title Reports** | Project Title Search, Legal Scrutiny Reports |
| **Document Vetting** | Legal vetting of property and loan documents |
| **Registration Services** | Property registration, mortgage, NOI, POA |
| **Financial Documents** | Franking, Gift Deeds, Leave & License agreements |
| **Public Notices** | English/Marathi newspaper notices, "No Claim" certificates |
| **Balance Transfer (BT)** | Legal transition of loans between financial institutions |

### The Problem We're Solving

| Bottleneck | Before (Manual) | After (AI Platform) |
|-----------|-----------------|-------------------|
| **Data Entry** | Staff spend hours reading Index II, calculating stamp duty | AI parses documents, auto-populates CRM |
| **Field Logistics** | Executives travel to collect docs, deposit cheques, visit SROs | Mobile PWA with instant status updates + offline mode |
| **Status Tracking** | Constant phone calls to track field executives | Real-time progress bars, WhatsApp/Email notifications |
| **Billing** | Manual timesheet management | Floating live timer, auto-generated utilization reports |
| **Client Communication** | High-volume manual updates | Client portal via Magic Links with real-time case tracking |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AG Associates AI Platform                         │
│                                                                      │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐  │
│  │      AI Agent Workforce      │  │     Collaboration Platform   │  │
│  │                              │  │                              │  │
│  │  ┌────────┐  ┌────────┐     │  │  Case State Machine          │  │
│  │  │ Aisha  │  │ Vyasa  │     │  │  (RECEIVED → CLOSED)         │  │
│  │  │Intake  │  │Research│     │  │                              │  │
│  │  └───┬────┘  └───┬────┘     │  │  Bank Portal (RLS-isolated)  │  │
│  │      │            │          │  │  ICICI ≠ Kotak ≠ Axis        │  │
│  │      ▼            ▼          │  │                              │  │
│  │  ┌────────┐  ┌────────┐     │  │  Document Vault              │  │
│  │  │Drafter │  │Executor│     │  │  Upload · Preview · Version  │  │
│  │  │Reports │  │Workflow│     │  │                              │  │
│  │  └───┬────┘  └───┬────┘     │  │  Real-time Collaboration     │  │
│  │      │            │          │  │  Presence · Comments · Tasks │  │
│  │      ▼            ▼          │  │                              │  │
│  │  ┌────────┐  ┌────────────┐ │  │  Client Portal               │  │
│  │  │Auditor │  │ Accountant │ │  │  Magic Links · Progress Bars │  │
│  │  │Compli. │  │ Bank Stmts │ │  │                              │  │
│  │  └────────┘  └────────────┘ │  └──────────────────────────────┘  │
│  └──────────────────────────────┘                                    │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                    Infrastructure Layer                        │   │
│  │  Supabase (PostgreSQL + RLS + Auth) · pgvector · Gemini Pro   │   │
│  │  Next.js 15 · FastAPI · LangGraph · Vercel AI SDK             │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS | App Router, glassmorphism dashboard |
| **Backend** | FastAPI (Python) | AI pipeline, document processing, API |
| **Database/Auth** | Supabase (PostgreSQL + RLS) | Multi-tenant data, RBAC, row-level security |
| **AI Engine** | Gemini Pro (Vercel AI SDK) | Document analysis, drafting, research |
| **Orchestration** | LangGraph | Multi-agent workflow management |
| **Embeddings** | SentenceTransformer (all-MiniLM-L6-v2) | RAG template retrieval (384-dim pgvector) |
| **LLM (Local)** | vLLM (Qwen 2.5-7B) | On-premise document generation |
| **Monitoring** | Sentry | Separate web + API error tracking |
| **Field App** | Progressive Web App (PWA) | Offline-capable mobile for executives |

---

## 🤖 The AI "Agentic" Workforce

Six specialized AI agents simulate a traditional law firm hierarchy at machine speed:

| Agent | Role | What It Does |
|-------|------|-------------|
| **Aisha** | Intake | Processes incoming case requests, extracts structured data from documents, classifies case type |
| **Vyasa** | Research | Legal opinion generation, Title Search analysis, precedent research |
| **Drafter** | Legal Architect | Automates creation of Title Reports, Legal Scrutiny Reports, Public Notices, Agreement drafts |
| **Executor** | Workflow Manager | Manages workflow triggers, SLA tracking, field assignment, system actions |
| **Auditor** | Compliance | Legal compliance verification, error-checking, quality scoring (pass ≥ 85/100) |
| **Accountant** | Finance | Ingests bank statements (pdfplumber), parses UTR/Loan numbers, reconciles with master ledgers |

> **"Zero human data entry = Zero errors."**

---

## 📋 Key Modules

### 🔍 AI Document Processor
- Deterministic AI for **Index II parsing** and property document summarization
- Auto-populates CRM and calculates stamp duty (e.g., 0.3% for NOI)
- Eliminates manual data entry bottleneck entirely

### 📱 Mobile PWA (Field Executives)
- Instant status updates: "Originals Collected," "Cheque Deposited," "At SRO"
- Camera scanner with **offline queue** for areas with poor connectivity
- GPS-tagged field activity for audit trail

### ⏱ Time Tracking & Billing Engine
- Floating live timer widget linked to specific clients/cases
- Auto-generates timesheets and utilization reports
- Tracks billable vs. non-billable hours for advocates and retired bankers

### 🏦 Bank Portal (Isolated Views)
- Read-only dashboards for each bank panel (ICICI, Kotak, Axis, etc.)
- **Supabase RLS ensures bank A cannot see bank B's data**
- Case progress, document status, SLA compliance metrics

### 💬 Client Portal & Notifications
- **Magic Links** — no password needed, secure access via email/WhatsApp
- Real-time progress bars for each case stage
- Multi-channel notifications (WhatsApp/Email) for status changes

### 📊 Case Management
- **13 specific case types** mapped to bank panel workflows
- 10-state machine: `RECEIVED → ASSIGNED → IN_PROGRESS → ... → INVOICED → CLOSED`
- SLA tracking with automated deadline alerts

---

## 📁 Repository Structure

```
AGASSOCIATES/
│
├── ag-associates-ai/              # 🤖 AI Document Pipeline
│   ├── backend/
│   │   ├── agents.py              #   LangGraph 6-agent pipeline
│   │   ├── main.py                #   FastAPI endpoints
│   │   ├── config.py              #   Environment configuration
│   │   ├── pdf_generator.py       #   ReportLab legal document output
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
│   │   ├── components/            #   React (admin, AI, bank, collaboration)
│   │   ├── server/                #   Express backend + AI router
│   │   └── hooks/                 #   React hooks (presence, notifications)
│   ├── supabase/migrations/       #   Database migrations
│   └── server.ts                  #   Express entry point
│
├── CLAUDE.md                      # 📖 Developer guidelines & gotchas
├── CONTRIBUTING.md                # 🤝 Contribution guide
├── SECURITY.md                    # 🔒 Security policy
└── tasks/                         # 📋 Task tracking & lessons learned
```

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Python 3.10+ (AI pipeline)
- Node.js 18+ (platform frontend)
- GPU with CUDA (optional — for local vLLM)

### AI Pipeline

```bash
git clone https://github.com/LUXORANOVA9/AGASSOCIATES.git
cd AGASSOCIATES/ag-associates-ai
cp .env.example .env

# Start infrastructure
docker-compose up -d

# Set up backend
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python generate_embeddings.py
python main.py                  # API at http://localhost:8001
```

### Collaboration Platform

```bash
cd ag-platform
npm install
cp .env.example .env            # Add Supabase URL & anon key
npm run dev
```

---

## ⚙️ Environment Variables

| File | Purpose | Key Variables |
|------|---------|---------------|
| `ag-associates-ai/.env` | Docker Compose | `POSTGRES_*`, `N8N_*`, `WHATSAPP_*` |
| `ag-associates-ai/backend/.env` | Python backend | `LLM_BASE_URL`, `EMBEDDING_MODEL_NAME`, `DATABASE_*` |
| `ag-platform/.env` | Supabase + platform | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY` |

---

## 🗺 Roadmap

### Phase 1: Internal Automation (72-Hour Sprint)
- [x] Database schema + Supabase RBAC authentication
- [x] Core case management engine (13 case types)
- [x] AI Document Processor (Index II parsing, stamp duty)
- [x] Accountant Agent (bank statement reconciliation)
- [x] 6-agent LangGraph pipeline
- [x] RAG-powered legal template retrieval
- [x] Bank portal with RLS isolation
- [x] Real-time collaboration (presence, comments, tasks)

### Phase 2: Field Operations
- [ ] Mobile PWA for field executives
- [ ] Camera scanner with offline queue
- [ ] GPS-tagged field activity tracking
- [ ] Live timer & billing engine

### Phase 3: White-Label SaaS
- [ ] Multi-tenant architecture (org_id parameterized)
- [ ] Theming engine (logo, colors, fonts per firm)
- [ ] Maharashtra-specific legal module (SRO data, stamp duty rates)
- [ ] Onboarding for 5,000–15,000 panel advocate firms across India

---

## 🔒 Security

- **Row-Level Security**: Supabase RLS isolates bank/client data at the database level
- **Data Sovereignty**: Deployed in `ap-south-1` (Mumbai) for Indian banking compliance
- **Audit Logging**: Every case state transition logged to immutable `case_audit_logs`
- **Document Vault**: Private buckets with 60-second signed URLs
- **Magic Links**: Passwordless client access with time-limited tokens

See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines, commit conventions, and code standards.

Read [CLAUDE.md](./CLAUDE.md) for architecture details, development setup, and known gotchas.

---

## 📜 License

Proprietary — AG Associates, Thane, Maharashtra.

See [LICENSE](./LICENSE) for details.

---

<p align="center">
  <sub>Built by <strong><a href="https://github.com/LUXORANOVA9">Raj Khemani</a></strong> · LUXORANOVA</sub>
  <br/>
  <sub>Powered by LangGraph, Supabase, Gemini Pro & vLLM · Targeting 15,000 panel advocate firms across India</sub>
</p>