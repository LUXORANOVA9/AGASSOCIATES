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
  <a href="#-deployment">Deployment</a> ·
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

### Tech Stack & The G-Stack Advantage

This platform is proudly engineered on the **G-Stack** (Google Stack), leveraging Google's premier AI and cloud infrastructure for unparalleled legal reasoning and scalability.

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **AI Reasoning (G-Stack)** | **Google Gemini Pro** | Complex legal document analysis, contract vetting, and precedent research |
| **Development (G-Stack)** | **Google Antigravity** | Agentic AI pair programming used to architect the entire Zero-Staff platform |
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS | App Router, glassmorphism dashboard |
| **Backend** | FastAPI (Python) & Express (Node.js) | AI pipeline, document processing, state machine API |
| **Database/Auth** | Supabase (PostgreSQL + RLS) | Multi-tenant data, RBAC, row-level security |
| **Orchestration** | LangGraph | Multi-agent workflow management |
| **Embeddings** | SentenceTransformer (`all-MiniLM-L6-v2`) | RAG template retrieval (384-dim pgvector) |
| **LLM (Local Backup)** | vLLM (Qwen 2.5-7B) | On-premise document generation (fallback) |
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

## 🚀 Deployment

The platform supports **fully automated deployment via GitHub Actions** as well as manual deployment. The AI Backend deploys to **Google Cloud Run** and the Frontend deploys to **Vercel**.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Python 3.10+ (AI pipeline)
- Node.js 18+ (platform frontend)
- GPU with CUDA (optional — for local vLLM)
- A [Supabase](https://supabase.com) project (production database & auth)
- A [Google Cloud](https://cloud.google.com) project (AI backend hosting)
- A [Vercel](https://vercel.com) account (frontend hosting)

---

### Automated Deployment (GitHub Actions)

Push to `main` triggers automated deployments. Configure the required secrets in your GitHub repository settings (**Settings > Secrets and variables > Actions**):

#### AI Backend Secrets (Cloud Run)

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_SA_KEY` | Service account JSON key with Cloud Run Admin + Artifact Registry Writer roles |

The following secrets must also be created in **Google Cloud Secret Manager** (referenced by Cloud Run at runtime):

| Secret Manager Secret | Description |
|-----------------------|-------------|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres` |
| `LLM_BASE_URL` | LLM endpoint (e.g., `https://api.groq.com/openai/v1` or your vLLM URL) |
| `LLM_MODEL_NAME` | Model name (e.g., `llama3-8b-8192`) |
| `CORS_ALLOWED_ORIGINS` | Production frontend URL (e.g., `https://ag-associates.com`) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase project settings |

#### Frontend Secrets (Vercel)

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel API token ([create here](https://vercel.com/account/tokens)) |
| `VERCEL_ORG_ID` | Vercel organization/team ID |
| `VERCEL_PROJECT_ID` | Vercel project ID (from `.vercel/project.json` after `vercel link`) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous public key |
| `VITE_AI_API_URL` | Production AI backend URL (e.g., `https://ag-ai-backend-xxxxx.run.app/api`) |

#### Workflow Files

| Workflow | Trigger | Target |
|----------|---------|--------|
| [`deploy-ai-backend.yml`](.github/workflows/deploy-ai-backend.yml) | Push to `main` (changes in `ag-associates-ai/`) or manual | Google Cloud Run |
| [`deploy-frontend.yml`](.github/workflows/deploy-frontend.yml) | Push to `main` (changes in `ag-platform/`) or manual | Vercel |

Both workflows also support **manual dispatch** via the GitHub Actions tab for on-demand deployments.

---

### Manual Deployment

#### Step 1: Database & Authentication (Supabase)

1. Create a new production project on [Supabase](https://supabase.com).
2. Go to the SQL Editor and run `ag-platform/src/server/migrations.sql` to create the `organizations`, `cases`, `profiles`, and `timesheets` tables.
3. Go to **Database > Extensions** and enable `vector` (pgvector) if not enabled by default.
4. Go to **Authentication > Providers** and configure your sign-in methods (Email/Password, Google, etc.).
5. Copy your **Project URL** and **anon public** key for use in the next steps.

#### Step 2: AI Backend (Google Cloud Run)

1. Create a production `.env` file:

   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   SUPABASE_JWT_SECRET=[YOUR_JWT_SECRET_FROM_SUPABASE]
   LLM_BASE_URL=https://api.groq.com/openai/v1
   LLM_MODEL_NAME=llama3-8b-8192
   CORS_ALLOWED_ORIGINS=https://ag-associates.com
   EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
   EMBEDDING_DIMENSION=384
   ```

2. Build and push the Docker image:

   ```bash
   cd ag-associates-ai
   docker build -t gcr.io/[PROJECT_ID]/ag-ai-backend .
   docker push gcr.io/[PROJECT_ID]/ag-ai-backend
   ```

3. Deploy to Cloud Run:

   ```bash
   gcloud run deploy ag-ai-backend \
     --image gcr.io/[PROJECT_ID]/ag-ai-backend \
     --region asia-south1 \
     --port 8001 \
     --memory 2Gi \
     --cpu 2 \
     --allow-unauthenticated
   ```

4. **Alternative (Render):** Connect your GitHub repo, point to `ag-associates-ai`, and set the start command to `uvicorn main:app --host 0.0.0.0 --port $PORT`.

#### Step 3: Frontend (Vercel)

1. Create a production `.env`:

   ```env
   VITE_SUPABASE_URL=[YOUR_PROJECT_URL]
   VITE_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
   VITE_AI_API_URL=https://[YOUR_BACKEND_URL]/api
   ```

2. Deploy via Vercel CLI:

   ```bash
   cd ag-platform
   npm install -g vercel
   vercel link
   vercel --prod
   ```

3. Or connect the `ag-platform` directory directly to Vercel via the dashboard. The `vercel.json` configuration is already included.

#### Step 4: Orchestration (n8n)

1. Deploy n8n via Docker or use [n8n Cloud](https://n8n.io/cloud).
2. Import your workflow JSON files.
3. Update HTTP Request nodes to point to your live AI Backend URL (e.g., `https://[YOUR_BACKEND_URL]/api/generate-agreement`).

---

### Pre-Flight Checks

After deployment, verify the following:

- [ ] **Health Check**: `curl https://[YOUR_BACKEND_URL]/health` returns `200 OK`.
- [ ] **JWT Bridge**: Log into the production frontend, verify Supabase authentication, and test API calls to the AI backend.
- [ ] **Field App**: Open the deployed site on a mobile device, toggle Airplane Mode, take a picture, and reconnect to verify the Offline Queue syncs.
- [ ] **Webhooks**: Send a test WhatsApp message and verify n8n triggers the Aisha agent.
- [ ] **Document Generation**: Submit a test agreement request via `/api/generate-agreement` and confirm PDF output.

---

### Environment Variables Reference

| File | Purpose | Key Variables |
|------|---------|---------------|
| `ag-associates-ai/.env` | Docker Compose | `POSTGRES_*`, `N8N_*`, `WHATSAPP_*` |
| `ag-associates-ai/backend/.env` | Python backend | `LLM_BASE_URL`, `EMBEDDING_MODEL_NAME`, `DATABASE_*` |
| `ag-platform/.env` | Supabase + platform | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY` |

See `.env.example` files in each directory for the complete list of configurable variables.

---

### Deployment Configuration Files

| File | Purpose |
|------|---------|
| [`ag-associates-ai/Dockerfile`](ag-associates-ai/Dockerfile) | Container image for the AI backend |
| [`ag-associates-ai/cloudbuild.yaml`](ag-associates-ai/cloudbuild.yaml) | Google Cloud Build config (alternative to GitHub Actions) |
| [`ag-platform/vercel.json`](ag-platform/vercel.json) | Vercel deployment settings (SPA rewrites, caching, security headers) |
| [`ag-platform/render.yaml`](ag-platform/render.yaml) | Render deployment config (alternative PaaS) |

---

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Cloud Run deploy fails with "permission denied" | Ensure the GCP service account has `Cloud Run Admin` and `Artifact Registry Writer` roles |
| Vercel build fails with missing env vars | Verify all `VITE_*` secrets are set in GitHub repo settings; Vite inlines them at build time |
| Frontend can't reach AI backend (CORS) | Update `CORS_ALLOWED_ORIGINS` in Cloud Run to include your Vercel domain |
| Database connection refused | Check the `DATABASE_URL` format and ensure Supabase allows connections from Cloud Run IPs |
| Embedding dimension mismatch | `EMBEDDING_DIMENSION` must be `384` to match `all-MiniLM-L6-v2`; if changed, update `init.sql` and re-run `generate_embeddings.py` |
| n8n can't reach backend | Use the public Cloud Run URL (not `localhost`) in n8n HTTP Request nodes |
| Docker build fails on M1/M2 Mac | Add `--platform linux/amd64` to the `docker build` command |

### Quick Start (Local Development)

For local development without deploying to the cloud:

```bash
# Clone and set up AI pipeline
git clone https://github.com/LUXORANOVA9/AGASSOCIATES.git
cd AGASSOCIATES/ag-associates-ai
cp .env.example .env
docker-compose up -d

cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python generate_embeddings.py
python main.py                  # API at http://localhost:8001
```

```bash
# Set up frontend platform
cd ag-platform
npm install
cp .env.example .env            # Add Supabase URL & anon key
npm run dev
```

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
