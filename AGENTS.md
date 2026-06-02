# AGENTS.md — OpenCode session guide

## Must read first

**`CLAUDE.md`** is the primary reference — comprehensive and authoritative. This file only adds context OpenCode sessions would likely miss.

**⚠ CLAUDE.md claims `.env.example` files exist at `ag-associates-ai/.env.example` and `ag-associates-ai/backend/.env.example`. They don't. Trust `config.py` defaults instead.**

## Two independent subsystems

| Directory | Stack | Has tests? | CI order |
|-----------|-------|-----------|----------|
| `ag-associates-ai/` | FastAPI + LangGraph + vLLM + Next.js 15 App Router + pgvector | **No** (do not invent) | `ruff check → ruff format --check → pip install --dry-run` |
| `ag-platform/` | Turborepo: Vite + Express + Supabase + Google Gemini (Vercel AI SDK) + shadcn/ui | Yes (`npm test`) | `lint → type-check → test → build` |

No code coupling between them. Never reuse config patterns across stacks.

## Commands (from CLAUDE.md, condensed)

### ag-associates-ai/
All commands in this section from `ag-associates-ai/` (the subdirectory, not the repo root).
```bash
docker-compose up -d          # pgvector:5432 + n8n:5678
docker-compose down -v        # wipe volumes
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python generate_embeddings.py # one-time: populate vector column
python main.py                # dev: runs on :8000 (__main__ block)
uvicorn main:app --reload --host 0.0.0.0 --port 8001  # prod-matching: respects config.py API_PORT
cd frontend && npm install && npm run dev  # Next.js on :3000
```

### ag-platform/
```bash
npm install            # root + all workspaces
npm run dev            # turbo dev → Vite + Express on :3001
npm test               # vitest run
npx vitest run tests/logger.test.ts  # single test
npm run type-check     # turbo type-check
npm run build          # vite build (not next build)
npm run start          # NODE_ENV=production tsx server.ts
```

**CI entry order** (main.yml): `pre-commit → lint → type-check → test → build`. Run locally in same order before pushing. Note: CI runs pre-commit and all subsystem checks in parallel; the order refers to the steps within each subsystem job.

## Gotchas that matter

- **LangGraph is synchronous.** API endpoints calling `process_rental_request` (the pipeline entrypoint) must wrap it in `asyncio.to_thread(...)` (see `backend/main.py:95`). Signature is `process_rental_request(raw_input, sender, org_id=None)` — the `org_id` parameter is newer and easy to miss.
- **Embedding dimension = 384** everywhere. If changed, update `config.py`, `database/init.sql`, and re-run `generate_embeddings.py`. Then `docker-compose down -v` to wipe pgvector volume.
- **No mock LLM mode.** Agents use `ChatOpenAI` pointed at local vLLM (`LLM_BASE_URL`). Without vLLM running, Aisha/Auditor raise errors. There's an `LLM_MOCK_MODE` in config but it has no effect in agents.py.
- **n8n → FastAPI networking:** n8n must reach FastAPI via `http://host.docker.internal:8001`, not `localhost`.
- **ag-platform migrations auto-run on boot.** `server.ts` runs `src/server/migrations.sql` against `pg` pool before mounting routes. Schema changes go in that file (not raw SQL in migration dirs). The `supabase/` migrations dir is for the hosted Supabase env only.
- **ag-platform uses Google Gemini** (`@ai-sdk/google`, model: `gemini-3.1-pro-preview`), not vLLM. See `src/server/aiRouter.ts`.
- **FastAPI backend has grown past the original pipeline.** `main.py` now includes voice, workforce, oauth, and playground routers plus a `UnifiedController`. The original 6-endpoint list in CLAUDE.md is incomplete.
- **Webhook endpoints require `x-api-key` auth.** Set `N8N_WEBHOOK_KEY` env var; endpoints verify it via `secrets.compare_digest`.
- **Sentry is optional.** Set `SENTRY_DSN` to enable; config respects `ENVIRONMENT` (dev/prod) for sample rates.
- **Root-level `*_GUIDELINES.md` files are policy.** Read the relevant one before touching that domain (error handling, RAG, TDD, git, UI, refactoring, hallucination).
- **`tasks/todo.md` and `tasks/lessons.md` are checked in, real, tracked.** On session start, check `tasks/lessons.md`. When the user corrects an approach, append the pattern there.
- **`CNAME` = `advadiityagade.com`.** GitHub Pages deploy path for Next.js dashboard via `nextjs.yml`.
- **Production deploy = Docker → GHCR → VPS** (deploy.yml). Three images: `ag-ai-backend`, `ag-ai-dashboard`, `ag-platform`. Pushed on push to `main` affecting `ag-associates-ai/` or `ag-platform/`.
- **Pre-commit** runs `ruff` (lint+fix + format) on Python, `eslint` on JS/TS. Install: `pre-commit install`. Hooks not enforced in CI, but commits fail locally.

## Key file paths

- `ag-associates-ai/backend/main.py` — FastAPI entry. Note: webhook path is `/webhooks/whatsapp` (with 's'), not `/webhook/whatsapp`.
- `ag-associates-ai/backend/agents.py` — LangGraph pipeline (Aisha → Drafter → Auditor). Entrypoint: `process_rental_request(raw_input, sender, org_id=None)`.
- `ag-associates-ai/backend/config.py` — env-based config with defaults.
- `ag-associates-ai/backend/pdf_generator.py` — ReportLab PDF generation.
- `ag-associates-ai/backend/controller_agent.py` — UnifiedController (conversations + MCP).
- `ag-platform/server.ts` — Express + Vite middleware entry. Port 3001.
- `ag-platform/src/server/aiRouter.ts` — Gemini AI endpoints (brief generator, vetting, summarizer, etc).
- `ag-platform/src/server/migrations.sql` — boot-time schema (cases, users, enums, RLS).
- `ag-platform/src/server/routes/cases.ts` — case CRUD + state machine transitions.
- `ag-platform/src/server/routes/timesheets.ts` — time tracking routes.
- `ag-platform/src/server/db.ts` — pg Pool connection (supports DATABASE_URL or individual params).
- `.pre-commit-config.yaml` — ruff + eslint hooks.
- `.github/workflows/main.yml` — CI (full pipeline).
- `.github/workflows/deploy.yml` — production VPS deploy via GHCR.
