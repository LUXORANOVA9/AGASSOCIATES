# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

The repo contains two major subsystems plus shared docs:

```
AGASSOCIATES/
├── ag-associates-ai/   # AI Document Pipeline (FastAPI + LangGraph + pgvector)
│   ├── backend/        #   Python backend (agents.py, main.py, config.py, pdf_generator.py)
│   ├── frontend/       #   Next.js 15 App Router dashboard
│   ├── database/       #   init.sql for PostgreSQL + pgvector
│   ├── docker-compose.yml  #   PostgreSQL (pgvector) + n8n
│   └── output/         #   Generated .md / .pdf agreements (created at runtime)
├── ag-platform/        # LegalTech Collaboration Platform (Turborepo + Supabase)
│   ├── packages/       #   Shared packages (ai, db, types, ui)
│   ├── src/            #   Vite + React frontend (App.tsx, components/, hooks/) +
│   │                   #   Express backend under src/server/ (routes, aiRouter, db, migrations.sql)
│   ├── services/       #   Intake API (Fastify gateway for bank-panel intake)
│   ├── supabase/       #   Supabase migrations
│   ├── tests/          #   Vitest tests (e.g. logger.test.ts)
│   ├── server.ts       #   Express entry — runs src/server/migrations.sql on boot
│   ├── render.yaml     #   Render.com deployment config
│   └── turbo.json      #   Turborepo pipeline (npm workspaces: apps/*, packages/*, services/*)
├── tasks/              # Task tracking (todo.md) + lessons learned (lessons.md)
├── content/            # Static marketing content (served via GitHub Pages CNAME)
├── *_GUIDELINES.md     # Root-level project policies — see "Project Policies" below
├── CLAUDE.md           # This file
├── CONTRIBUTING.md     # Contribution guide
└── SECURITY.md         # Security policy
```

## Common Commands

The two subsystems are independent — `ag-associates-ai/` uses Python + Docker + Next.js; `ag-platform/` is a Turborepo. Commands below specify which.

### ag-associates-ai/

All paths in this subsection are relative to `ag-associates-ai/`.

**Infrastructure (Postgres + n8n):**
```bash
docker-compose up -d                 # bring up pgvector (5432) + n8n (5678)
docker-compose down                  # stop
docker-compose down -v               # stop + wipe postgres_data/n8n_data volumes
```

**Backend (FastAPI, port 8001):**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python generate_embeddings.py        # one-time: populate vector column for seeded templates
python main.py                       # or: uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

**Frontend (Next.js, port 3000):**
```bash
cd frontend
npm install
npm run dev                          # dev server
npm run build && npm run start       # production build + serve
npm run lint                         # next lint
```

**vLLM (external, port 8000 — not in docker-compose):**
```bash
python -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-7B-Instruct --host 0.0.0.0 --port 8000
```

`ag-associates-ai/` has **no test suite** (no pytest/jest config, no `tests/` directory). If asked to "run the tests" here, confirm with the user before inventing one. `ag-platform/` does have tests — see below.

### ag-platform/

All paths in this subsection are relative to `ag-platform/`. It's an npm-workspaces + Turborepo monorepo.

```bash
npm install                          # installs root + all workspaces
npm run dev                          # turbo dev (runs Vite frontend + Express backend)
npm run build                        # turbo build
npm run lint                         # turbo lint
npm run type-check                   # turbo type-check
npm test                             # vitest run (single run, not watch)
npx vitest run tests/logger.test.ts  # run one test file
npx vitest                           # watch mode
```

The Express entry is [server.ts](ag-platform/server.ts); it boots Vite in middleware mode and runs `src/server/migrations.sql` against the Postgres pool defined in `src/server/db.ts` on startup. Deployment is configured via [render.yaml](ag-platform/render.yaml).

### Pre-commit hooks

[.pre-commit-config.yaml](.pre-commit-config.yaml) runs `ruff` (lint + format) on Python and `eslint` on `.[jt]sx?` files, plus standard hygiene hooks (trailing-whitespace, large-files, detect-private-key). Install once with `pre-commit install`; run on demand with `pre-commit run --all-files`. Hooks are not yet enforced in CI, but commits fail locally if violations are present.

## Architecture

The two subsystems have **separate architectures, separate stacks, and no code-level coupling** — they share only a domain (legal ops for Indian panel advocates) and the root-level guideline files. Don't assume changes in one carry over to the other.

### ag-associates-ai/ — AI Document Pipeline

A 4-tier pipeline; understanding the data flow between tiers is essential before modifying any single piece.

```
WhatsApp ──► n8n (5678) ──► FastAPI /webhook/whatsapp (8001)
                                      │
                                      ▼
                          LangGraph: Aisha ──► Drafter ──► Auditor ──┐
                                      │            │         │       │
                                      ▼            ▼         ▼   pass/fail loop
                            vLLM (8000)   pgvector RAG   vLLM audit  │
                                                                     ▼
                                                             PDF via ReportLab
                                                                     │
                                                                     ▼
                                                       /api/nesl/execute (mock)
                                                                     │
                             Next.js dashboard (3000) polls /dashboard/status
```

**LangGraph pipeline (`backend/agents.py`)** is the heart of the system. It's a `StateGraph` with three nodes sharing a single `AgentState` TypedDict:

1. **`aisha_intake_node`** — Uses `ChatOpenAI` pointed at the local vLLM server to extract structured JSON (tenant, landlord, rent, address, dates, deposit) from raw text. Low temperature (0.1) + `JsonOutputParser`.
2. **`drafter_node`** — Runs `similarity_search()` against `legal_templates` in pgvector, selects the best template, uses vLLM (temp 0.3) to inject extracted fields, writes markdown to `output/`, then calls `pdf_generator.convert_to_pdf()`. Falls back to any Maharashtra template if similarity search returns nothing. Increments `revision_count`.
3. **`auditor_node`** — Scores the draft 0–100 against the extracted fields; `passed = score ≥ 85 && no critical issues`.

Other specialized agents in the workforce include `executor_agent.py` (workflow management) and `accountant_agent.py` (bank statement reconciliation).

Routing is via `should_revise()`: on fail, loops back to `drafter` up to 3 revisions, then forces finish. Entry point is `aisha_intake`; exits at `END`.

`process_rental_request(raw_input, sender)` is the single public entrypoint into the graph and is called from both `/webhook/whatsapp` and `/api/generate-agreement` in `main.py`. Both endpoints wrap it in `asyncio.to_thread(...)` because the graph is synchronous and does blocking LLM/DB calls — preserve this pattern when adding new entrypoints.

**FastAPI endpoints (`backend/main.py`):**
- `GET /health` — liveness
- `POST /webhook/whatsapp` — n8n → backend bridge (payload: `WebhookPayload`)
- `POST /api/generate-agreement` — direct API entry (`AgreementRequest` → `WorkflowResponse`)
- `GET /dashboard/status` — counts templates, returns mocked `active_agents=3` and stub activities
- `GET /templates` — lists templates, filters by `template_type` and `language`
- `POST /api/nesl/execute` — **mock** government filing; sleeps 3s and returns a random `NESL-…` transaction ID

**Frontend (`frontend/app/page.tsx`)** is a single-page dashboard (`'use client'`). It does two independent things:
- Polls `GET /dashboard/status` every 3s for real metrics.
- Runs a **simulated** workflow cycle locally (setTimeout chain, 4s/step, 5s pause) that drives the progress UI and fires `POST /api/nesl/execute` exactly once per cycle. The guards (`neslFiledForCycleRef`, `neslAbortRef`) exist to prevent overlapping calls — don't remove them.

**Database (`database/init.sql`)** is auto-loaded by the `pgvector/pgvector:pg16` container on first start. Creates `legal_templates(id, title, content, template_type, jurisdiction, language, embedding vector(384), …)` with an `ivfflat` cosine index and seeds three Maharashtra rent-agreement templates (English, Marathi, Hindi) with `embedding = NULL`.

### ag-platform/ — LegalTech Collaboration Platform

A separate, more conventional web app — not a 4-tier AI pipeline. See [ag-platform/ARCHITECTURE.md](ag-platform/ARCHITECTURE.md) for the full design doc. Key points future Claude needs to know:

- **`Cases` is the central entity.** Everything (documents, disbursements, invoices) hangs off it. Every table carries `org_id` for forward-compatible multi-tenancy enforced via Supabase RLS.
- **Case lifecycle is a strict state machine** with 10 states (`RECEIVED → ASSIGNED → DOCUMENT_COLLECTION → IN_PROGRESS → PENDING_REGISTRATION → REGISTERED → QUALITY_CHECK → DELIVERED → INVOICED → CLOSED`, plus `ON_HOLD / REJECTED / CANCELLED`). There are 13 specific case types mapped to bank panel workflows. Each transition is gated on a role (PRINCIPAL/ADVOCATE/EXECUTIVE/CLERK/BANK_VIEWER) and fires side-effects (WhatsApp/email). New transitions must be added to both the DB constraint and the route handlers in [src/server/routes/](ag-platform/src/server/routes/).
- **Intake Gateway.** A high-performance **Fastify** gateway in `services/intake-api/` handles bank-panel intake with Zod-validated webhooks and a Redis-backed OTP bridge.
- **Stack divergence vs. `ag-associates-ai/`:** Postgres via **Supabase** (not raw pgvector), **Google Gemini** via Vercel AI SDK (not local vLLM), and **shadcn/ui + Tailwind** on a Vite-served React app (not Next.js). Don't reuse `ag-associates-ai/` config patterns here.
- **Migrations run on boot.** [server.ts](ag-platform/server.ts) reads `src/server/migrations.sql` and executes it against `pool` from `src/server/db.ts` before mounting routes. Schema changes belong in that file; Supabase migrations under [supabase/](ag-platform/supabase/) are for the hosted environment.
- **Workspaces folders that don't exist yet.** [package.json](ag-platform/package.json) declares `workspaces: ["apps/*", "packages/*", "services/*"]` but only `packages/` is populated today (`ai`, `db`, `types`, `ui`). The Vite app + Express server live at the repo root, not under `apps/`. If you scaffold an `apps/` workspace, expect Turborepo to start picking it up automatically.

## Key Conventions & Gotchas

- **Output path.** `OUTPUT_DIR` in `config.py` defaults to `../output` relative to `backend/`. Both `agents.py` and `pdf_generator.py` use this via `from config import OUTPUT_DIR`. The directory is auto-created at runtime. Override with the `OUTPUT_DIR` env var if you need a custom location.
- **Embedding dimension alignment.** `database/init.sql`, `config.py`, and `.env.example` all declare dimension `384` to match the `all-MiniLM-L6-v2` model. If you swap the embedding model, update `EMBEDDING_DIMENSION` in config, the `vector(N)` declaration in `init.sql`, and re-run `generate_embeddings.py`. Existing deployments must `docker-compose down -v` to wipe the pgvector volume.
- **`generate_embedding()` in `agents.py` uses a lazy-loaded `SentenceTransformer`** (same model as `generate_embeddings.py`). The model is loaded on first RAG query, not at import time.
- **LLM client assumes local vLLM.** Agents use `ChatOpenAI(openai_api_base=LLM_BASE_URL, openai_api_key="not-needed")`. When testing without a running vLLM, Aisha/Auditor will raise and `process_rental_request` will return `{"success": False, "error": ...}`. There is no retry or mock mode.
- **n8n-to-backend networking.** n8n runs in Docker; to reach the FastAPI host, it uses `http://host.docker.internal:8001` (see `N8N_WHATSAPP_SETUP.md`), not `localhost`.
- **Frontend API base URL.** Configured via `NEXT_PUBLIC_API_URL` (default `http://localhost:8001`). Must be an env var — it's inlined at build time.
- **Dependency versions are pinned and bleeding-edge.** `langchain==0.3.0.dev1`, `langgraph==1.0.10rc1`, `langchain-openai==1.1.14`. Older docs in `LANGGRAPH_AGENTS.md` cite different versions (0.0.29 / 0.1.0) — trust `requirements.txt`. Next.js is `15.5.15` with the App Router.
- **`.env.example` files exist** at both `ag-associates-ai/.env.example` (compose vars) and `ag-associates-ai/backend/.env.example` (backend vars). Copy and customize before running. Defaults in `config.py` include `secure_password_123` which is dev-only.

## Git Workflow & CI

- Use feature branches (`fix/...`, `feat/...`, `docs/...`) and open PRs. Avoid pushing directly to main.
- **CI workflows in [.github/workflows/](.github/workflows/):**
  - `codeql.yml` — CodeQL on `javascript-typescript` and `python` for pushes/PRs to `main` and weekly.
  - `nextjs.yml` — builds `ag-associates-ai/frontend` and **deploys to GitHub Pages on every push to `main`** (this is the production deploy path for the Next.js dashboard; the [CNAME](CNAME) file at root points it at the live domain). Verify `next build` succeeds locally before merging.
  - `main.yml` — additional pipeline; inspect before relying on its behavior for a given change.
- Lint/tests are **not** enforced in CI. Local `pre-commit` is the only mechanical gate.
- The status markers in `ag-associates-ai/README.md` ("Day 1/2/3 ✅/❌") and the `DAY3_COMPLETE.md` / `LANGGRAPH_AGENTS.md` narratives describe the original 72-hour build roadmap. Treat them as historical context, not as a current TODO list.

## Project Policies

The repo root contains a set of `*_GUIDELINES.md` files that encode project-specific conventions. They are policy, not aspiration — read the one relevant to your task before substantial work:

- [ERROR_HANDLING_GUIDELINES.md](ERROR_HANDLING_GUIDELINES.md) — error/log conventions (note the recent `security: sanitize error logs` commits — there is a `sanitize()` util in `ag-platform/src/server/utils/logger.ts` that is now load-bearing).
- [FRONTEND_UI_GUIDELINES.md](FRONTEND_UI_GUIDELINES.md), [REFACTORING_GUIDELINES.md](REFACTORING_GUIDELINES.md), [TDD_GUIDELINES.md](TDD_GUIDELINES.md), [GIT_GUIDELINES.md](GIT_GUIDELINES.md) — self-explanatory.
- [HALLUCINATION_MITIGATION_GUIDELINES.md](HALLUCINATION_MITIGATION_GUIDELINES.md), [RAG_AND_MEMORY_GUIDELINES.md](RAG_AND_MEMORY_GUIDELINES.md) — apply when touching the LangGraph pipeline or pgvector RAG.
- [GOAL_DRIVEN_EXECUTION_GUIDELINES.md](GOAL_DRIVEN_EXECUTION_GUIDELINES.md), [DEPLOYMENT_PLAYBOOK.md](DEPLOYMENT_PLAYBOOK.md) — process docs.
- [tasks/todo.md](tasks/todo.md) and [tasks/lessons.md](tasks/lessons.md) are tracked, real files. When the user corrects an approach, append the pattern (with cause and remedy) to `tasks/lessons.md` and review it at the start of new sessions.
