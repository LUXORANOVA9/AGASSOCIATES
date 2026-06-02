# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

The repo contains two major subsystems plus shared docs and ops tooling:

```
AGASSOCIATES/
├── ag-associates-ai/   # AI Document Pipeline + Aisha "Chief of Staff" (FastAPI + LangGraph + pgvector)
│   ├── backend/        #   Python backend — see "ag-associates-ai backend map" below
│   ├── frontend/       #   Next.js 15 App Router dashboard (page.tsx, dashboard/, noi-cases/, noi-mobile/)
│   ├── database/       #   init.sql for PostgreSQL + pgvector
│   ├── tests/          #   pytest (test_noi_logic.py, test_noi_workflow.py)
│   ├── docker-compose.yml  #   postgres (pgvector) + redis + n8n + backend
│   └── output/         #   Generated .md / .pdf agreements (created at runtime)
├── ag-platform/        # LegalTech Collaboration Platform (Turborepo + Supabase + Vite/Express)
│   ├── packages/       #   Shared packages (ai, db, types, ui)
│   ├── src/            #   Vite + React frontend + Express backend under src/server/
│   ├── apps/mobile/    #   @ag/mobile — Expo / React Native app
│   ├── services/       #   intake-api (Fastify gateway for bank-panel intake)
│   ├── supabase/       #   Supabase migrations + edge functions
│   ├── tests/          #   Vitest tests
│   ├── server.ts       #   Express entry — runs src/server/migrations.sql on boot
│   └── turbo.json      #   Turborepo pipeline (npm workspaces: apps/*, packages/*, services/*)
├── prototype/noi-dashboard/  # Standalone Vite prototype for the NOI dashboard
├── scripts/            # VPS/runner ops: bootstrap-vps.sh, provision.sh, auto-deploy.sh, setup-runner.sh, …
├── supabase/migrations/      # Repo-root Supabase migrations (e.g. NOI status column)
├── docs/               # strategic-plan.md, noi-automation-plan.md, adr/ (architecture decision records)
├── .devcontainer/      # Codespaces / cloud dev setup
├── tasks/              # Task tracking (todo.md) + lessons learned (lessons.md)
├── content/, landing/  # Static marketing content (served via GitHub Pages CNAME)
├── *_GUIDELINES.md     # Root-level project policies — see "Project Policies" below
└── CLAUDE.md / CONTRIBUTING.md / SECURITY.md / GOVERNANCE.md / CULTURE.md / CONTEXT.md
```

## Common Commands

The two subsystems are independent — `ag-associates-ai/` uses Python + Docker + Next.js; `ag-platform/` is a Turborepo. Commands below specify which.

### ag-associates-ai/

All paths in this subsection are relative to `ag-associates-ai/`.

**Infrastructure (Postgres + Redis + n8n + backend):**
```bash
docker-compose up -d                 # pgvector (5432) + redis (6379) + n8n (5678) + backend (8001)
docker-compose down                  # stop
docker-compose down -v               # stop + wipe postgres_data/redis_data/n8n_data/backend_output volumes
```

**Backend (FastAPI, port 8001):**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python generate_embeddings.py        # one-time: populate vector column for seeded templates
python main.py                       # or: uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

**Tests (pytest):**
```bash
cd ag-associates-ai
pip install pytest
python -m pytest -v                  # discovers tests/ and backend/test_*.py
python -m pytest tests/test_noi_workflow.py -v   # single file
```
This subsystem **now has tests** (CI's "AI Backend — Tests" job runs `python -m pytest` from `backend/`). This is a change from the original "no test suite" state — don't remove tests, and prefer adding coverage when touching the NOI/agent code.

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
When no LLM is reachable, set `LLM_MOCK_MODE=true` to exercise the pipeline without vLLM (see `config.py`).

### ag-platform/

All paths in this subsection are relative to `ag-platform/`. It's an npm-workspaces + Turborepo monorepo.

```bash
npm install                          # installs root + all workspaces
npm run dev                          # turbo dev (Vite frontend + Express backend)
npm run build                        # vite build
npm run lint                         # turbo lint
npm run type-check                   # turbo type-check
npm test                             # vitest run (--config ./vitest.config.ts)
npx vitest run tests/logger.test.ts  # run one test file
npx vitest                           # watch mode
```

The Express entry is [server.ts](ag-platform/server.ts); it boots Vite in middleware mode and runs `src/server/migrations.sql` against the Postgres pool in `src/server/db.ts` on startup. Deployment is configured via [render.yaml](ag-platform/render.yaml). The mobile app under `apps/mobile/` (`@ag/mobile`) is an Expo project with its own `package.json` and `__tests__/`.

### Pre-commit hooks

[.pre-commit-config.yaml](.pre-commit-config.yaml) runs `ruff` (lint + format) on Python and `eslint` on `.[jt]sx?` files, plus standard hygiene hooks. Install once with `pre-commit install`; run on demand with `pre-commit run --all-files`. CI's "Lint — Pre-commit" job enforces this on PRs.

## Architecture

The two subsystems have **separate architectures, separate stacks, and no code-level coupling** — they share only a domain (legal ops for Indian panel advocates) and the root-level guideline files. Don't assume changes in one carry over to the other.

### ag-associates-ai/ — AI Document Pipeline + Aisha

What began as a 3-agent rent-agreement pipeline is now a multi-platform AI workforce. There are two layers to understand:

**1. The LangGraph drafting pipeline (`backend/agents/` package).**
Originally a single `agents.py`; now split into a package whose public API is re-exported from `agents/__init__.py` (so `from agents import process_rental_request` still works). The graph (`agents/graph.py`) is a `StateGraph` over a single `AgentState` TypedDict (`agents/state.py`) with five nodes:

```
aisha_intake → guardrail → bouncer → drafter → auditor
  (extract)     (regex)    (math)    (RAG+LLM)  (QA, loops to drafter ≤3×)
```

- **`aisha` (`agents/aisha.py`)** — vLLM + `JsonOutputParser`, temp 0.1, extracts structured fields (tenant, landlord, rent, address, dates, deposit, stamp duty).
- **`guardrail` (`agents/guardrail.py`)** — regex/policy checks; sets `guardrail_passed`. On fail the graph ends early.
- **`bouncer` (`agents/bouncer.py` + `stamp_duty.py`)** — validates stamp-duty math; sets `bouncer_passed`. On fail the graph ends early.
- **`drafter` (`agents/drafter.py` + `db.py`)** — `similarity_search()` over `legal_templates` in pgvector, injects fields via vLLM (temp 0.3), writes markdown to `output/`, then PDF via `pdf_generator.convert_to_pdf()` (gated by `PDF_ENABLED`). Increments `revision_count`.
- **`auditor` (`agents/auditor.py`)** — scores 0–100; `audit_passed = score ≥ 85 && no critical issues`. `should_revise()` loops back to `drafter` up to 3 times, else finishes.

`process_rental_request(raw_input, sender)` is the single public entrypoint into the graph. It is synchronous and does blocking LLM/DB calls, so callers wrap it in `asyncio.to_thread(...)` — preserve this pattern.

**2. Aisha, the cross-platform "Chief of Staff" (`backend/aisha_core.py`).**
`handle_message()` is the platform-agnostic entry point that all adapters (WhatsApp, Telegram, Voice, SMS, Web, Phone) route through. It classifies intent and dispatches to (a) the LangGraph pipeline for `legal_draft`, (b) `VoxRouter` for admin voice commands, or (c) general LLM chat. Conversation state lives in `conversation_store.py`.

**Supporting subsystems under `backend/`:**
- **`voice/`** — Vyasa voice control: `whisper_service` (STT), `piper_service` (TTS), `vox_router` (LLM routes transcripts → tools via `tool_registry`), `wakeword_listener`, plus `voice_api.py` router and per-channel audit/rate-limit/RBAC.
- **`telegram_bot/`** — standalone bot (OTP bridge, Aisha chat, voice mode, Hindi TTS, `/audit` Excel finance auditor, bank-OTP auto-forward). Has its own `Dockerfile`/`requirements.txt`.
- **NOI / e-filing stack** — `noi_agent.py` (Notice of Intimation workflow + state machine), `igr_executor.py` (Playwright RPA against the Maharashtra IGR portal, Section 89B), `nesl_client.py` (dual-mode: API / RPA / mock NeSL filing), `selector_config.py` (Supabase-backed, env-overridable DOM selectors so RPA survives portal changes).
- **Reliability** — `circuit_breaker.py` (breakers around external/RPA calls) and `hitl_queue.py` (human-in-the-loop task queue surfaced via `/api/hitl/*`).
- **`workforce/`** — activity `ledger`, `anomaly` detection, and a `workforce_router`; `controller_agent.py` (`UnifiedController`) orchestrates tasks over MCP tools (`utils/mcp_client.py`).
- **`payment/`** — Stripe client + webhook + router. **`playground/`** — browser-automation sessions. **`email_intake/`** — email→case agent. **`auth/`** — Google OAuth + RBAC + FastAPI deps.

**FastAPI endpoints (`backend/main.py`)** mount routers for voice, workforce, auth/oauth, playground, and payment, plus standalone routes. Note the WhatsApp webhook path is `/webhooks/whatsapp` (plural). Key groups: `/health`, `/webhooks/*` (ingestion), `/api/generate-agreement`, `/api/aisha/*` (chat/sms/voice-call/voice-text + SSE stream), `/api/unified/chat`, `/api/nesl/execute`, `/api/noi/*` (seed/workflow/status/webhook), `/api/hitl/*`, `/api/circuit-breakers`, `/dashboard/status`, `/templates`.

**Frontend (`frontend/app/page.tsx`)** polls `GET /dashboard/status` every 3s and runs a *simulated* workflow cycle locally that fires `POST /api/nesl/execute` once per cycle (guarded by `neslFiledForCycleRef` / `neslAbortRef` — don't remove). Additional pages: `dashboard/`, `noi-cases/`, `noi-mobile/`.

**Database (`database/init.sql`)** auto-loads on first `pgvector/pgvector:pg16` start. Creates `legal_templates(... embedding vector(384) ...)` with an `ivfflat` cosine index and seeds three Maharashtra rent templates (English/Marathi/Hindi) with `embedding = NULL`.

### ag-platform/ — LegalTech Collaboration Platform

A separate, more conventional web app. See [ag-platform/ARCHITECTURE.md](ag-platform/ARCHITECTURE.md) for the full design doc. Key points:

- **`Cases` is the central entity.** Everything (documents, disbursements, invoices, timesheets) hangs off it. Every table carries `org_id` for multi-tenancy via Supabase RLS.
- **Case lifecycle is a strict state machine** (`RECEIVED → … → CLOSED`, plus `ON_HOLD / REJECTED / CANCELLED`) with 13 case types mapped to bank-panel workflows. Each transition is role-gated and fires side-effects. New transitions must be added to both the DB constraint and the route handlers in [src/server/routes/](ag-platform/src/server/routes/) (`cases.ts`, `timesheets.ts`).
- **Intake Gateway.** A Fastify gateway in `services/intake-api/` handles bank-panel intake with Zod-validated webhooks and a Redis-backed OTP bridge.
- **Stack divergence vs. `ag-associates-ai/`:** Postgres via **Supabase**, **Google Gemini** via Vercel AI SDK (not local vLLM), **shadcn/ui + Tailwind** on a Vite-served React app (not Next.js). Don't reuse `ag-associates-ai/` config patterns here.
- **Migrations run on boot.** [server.ts](ag-platform/server.ts) executes `src/server/migrations.sql` before mounting routes. Schema changes belong there; `supabase/migrations/` is for the hosted environment.
- **`apps/` is now populated.** `apps/mobile/` (`@ag/mobile`, Expo) is picked up by Turborepo/npm workspaces. The Vite app + Express server still live at the repo root, not under `apps/`.

## Key Conventions & Gotchas

- **Dependency versions are no longer bleeding-edge dev pins.** `backend/requirements.txt` now uses ranges (`langgraph>=1.0.0`, `langchain>=0.3.0`, `langchain-openai>=0.2.0`, etc.) plus voice/RPA deps (`faster-whisper`, `piper-tts`, `playwright`, `boto3`, `redis`, `crewai`, `sentry-sdk`). Trust `requirements.txt` over older narrative docs (`LANGGRAPH_AGENTS.md`, `DAY3_COMPLETE.md`), which are historical.
- **Feature flags in `config.py`.** `LLM_MOCK_MODE` (run pipeline without vLLM), `PDF_ENABLED` (skip ReportLab PDF generation when false). LLM client still assumes local vLLM: `ChatOpenAI(openai_api_base=LLM_BASE_URL, openai_api_key="not-needed")`.
- **Output path.** `OUTPUT_DIR` in `config.py` defaults to `../output` relative to `backend/`; auto-created at runtime. Override via env var.
- **Embedding dimension alignment.** `database/init.sql`, `config.py`, and `.env.example` all declare `384` (for `all-MiniLM-L6-v2`). If you change the model, update `EMBEDDING_DIMENSION`, the `vector(N)` in `init.sql`, re-run `generate_embeddings.py`, and `docker-compose down -v` existing deployments.
- **NOI state machine is transition-validated.** `noi_agent.py` defines `NOI_TRANSITIONS` (not just a flat list); `update_noi_status()` rejects invalid transitions unless `force=True`. External webhooks (GRAS/bank) force-skip validation because real-world events arrive out of order. See [docs/adr/0002-noi-state-machine.md](docs/adr/0002-noi-state-machine.md) before changing states.
- **RPA selectors are configurable.** `selector_config.py` resolves IGR/GRAS/NeSL DOM selectors from a Supabase `supabase_config` table → env vars (`IGR_SEL_*` / `GRAS_SEL_*`) → hardcoded defaults. Prefer config changes over editing selectors in code.
- **n8n-to-backend networking.** n8n (Docker) reaches the backend via `http://host.docker.internal:8001`, not `localhost`.
- **Frontend API base URL.** `NEXT_PUBLIC_API_URL` (default `http://localhost:8001`) is inlined at build time — must be an env var.
- **`.env.example` files** exist at `ag-associates-ai/.env.example` and `ag-associates-ai/backend/.env.example`. Defaults like `secure_password_123` are dev-only.

## Git Workflow & CI

- Use feature branches (`fix/...`, `feat/...`, `docs/...`) and open PRs. Avoid pushing directly to main.
- **CI workflows in [.github/workflows/](.github/workflows/):**
  - `ci.yml` / `main.yml` — pre-commit lint, `ruff check`/`ruff format --check` + `pytest` on the AI backend, and the Turborepo platform build. (Both are named "CI"; `ci.yml` is the primary gate.)
  - `codeql.yml` — CodeQL on `javascript-typescript` and `python`.
  - `nextjs.yml` — builds `ag-associates-ai/frontend` and **deploys to GitHub Pages on push to `main`** (production deploy for the dashboard; [CNAME](CNAME) points it at the live domain). Verify `next build` locally before merging.
  - `deploy.yml` — deploys the stack to a VPS via a **self-hosted runner** (`[self-hosted, linux, x64]`, `production` environment) on push to `main`; supports `workflow_dispatch` with `service`/`ref` inputs. Backed by `scripts/` (`auto-deploy.sh`, `bootstrap-vps.sh`, `provision.sh`, `setup-runner.sh`). See [DEPLOYMENT_PLAYBOOK.md](DEPLOYMENT_PLAYBOOK.md).
  - `ag-platform/.github/workflows/sonarcloud.yml` — SonarCloud analysis for the platform.
- Local `pre-commit` is enforced in CI; lint/tests beyond the jobs above are advisory.

## Project Policies

The repo root contains `*_GUIDELINES.md` files that encode project conventions. They are policy, not aspiration — read the relevant one before substantial work:

- [ERROR_HANDLING_GUIDELINES.md](ERROR_HANDLING_GUIDELINES.md) — error/log conventions. A `sanitize()` util in `ag-platform/src/server/utils/logger.ts` is load-bearing for log sanitization.
- [FRONTEND_UI_GUIDELINES.md](FRONTEND_UI_GUIDELINES.md), [REFACTORING_GUIDELINES.md](REFACTORING_GUIDELINES.md), [TDD_GUIDELINES.md](TDD_GUIDELINES.md), [GIT_GUIDELINES.md](GIT_GUIDELINES.md).
- [HALLUCINATION_MITIGATION_GUIDELINES.md](HALLUCINATION_MITIGATION_GUIDELINES.md), [RAG_AND_MEMORY_GUIDELINES.md](RAG_AND_MEMORY_GUIDELINES.md) — apply when touching the LangGraph pipeline or pgvector RAG.
- [GOAL_DRIVEN_EXECUTION_GUIDELINES.md](GOAL_DRIVEN_EXECUTION_GUIDELINES.md), [DEPLOYMENT_PLAYBOOK.md](DEPLOYMENT_PLAYBOOK.md), [DEVIN_PLAYBOOK.md](DEVIN_PLAYBOOK.md) — process docs. [GOVERNANCE.md](GOVERNANCE.md), [CULTURE.md](CULTURE.md), [CONTEXT.md](CONTEXT.md) give org/product context.
- [docs/adr/](docs/adr/) — architecture decision records (monorepo orchestration, NOI state machine). Check these before reworking those areas.
- [tasks/todo.md](tasks/todo.md) and [tasks/lessons.md](tasks/lessons.md) are tracked, real files. When the user corrects an approach, append the pattern (cause + remedy) to `tasks/lessons.md` and review it at the start of new sessions.
