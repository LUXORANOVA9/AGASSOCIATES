# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

The repo root (`AGASSOCIATES/`) is a thin shell: its `README.md` is a placeholder and `package-lock.json` is empty. All real code lives under `ag-associates-ai/`, which is the actual project. When in doubt, treat `ag-associates-ai/` as the working root.

```
ag-associates-ai/
├── backend/       # FastAPI + LangGraph (Python)
├── frontend/      # Next.js 15 App Router dashboard (TypeScript)
├── database/      # init.sql for PostgreSQL + pgvector
├── docker-compose.yml  # PostgreSQL (pgvector) + n8n
└── output/        # Generated .md / .pdf agreements (created at runtime)
```

## Common Commands

All paths are relative to `ag-associates-ai/`.

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

There is currently **no test suite** (no pytest/jest config, no `tests/` directory). If asked to "run the tests," confirm with the user before inventing one.

## Architecture

The system is a 4-tier pipeline; understanding the data flow between tiers is essential before modifying any single piece.

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

**Database (`database/init.sql`)** is auto-loaded by the `pgvector/pgvector:pg16` container on first start. Creates `legal_templates(id, title, content, template_type, jurisdiction, language, embedding vector(768), …)` with an `ivfflat` cosine index and seeds three Maharashtra rent-agreement templates (English, Marathi, Hindi) with `embedding = NULL`.

## Key Conventions & Gotchas

- **Hardcoded absolute output path.** `backend/agents.py` and `backend/pdf_generator.py` write to `/workspace/ag-associates-ai/output/...` (not a relative path, not `OUTPUT_DIR` from config). Either create that directory, run inside a container that mounts it, or fix the paths — the code will `FileNotFoundError` otherwise. `config.py` defines `OUTPUT_DIR` but it's currently unused by the writers.
- **Embedding dimension mismatch.** `database/init.sql` declares `vector(768)`; `config.py` defaults `EMBEDDING_DIMENSION=384` (matching `all-MiniLM-L6-v2`); `generate_embeddings.py` pads/truncates to `EMBEDDING_DIMENSION` before insert. If you change the model, update the SQL schema and re-run `generate_embeddings.py`, or inserts will fail.
- **`generate_embedding()` in `agents.py` is a stub** that returns `np.random.rand(...)` — the *query-side* RAG lookup is effectively random until replaced with a real embedding call (e.g., reusing the `SentenceTransformer` from `generate_embeddings.py`). The drafter falls back to the first Maharashtra template, which is why the system still "works" end-to-end.
- **LLM client assumes local vLLM.** Agents use `ChatOpenAI(openai_api_base=LLM_BASE_URL, openai_api_key="not-needed")`. When testing without a running vLLM, Aisha/Auditor will raise and `process_rental_request` will return `{"success": False, "error": ...}`. There is no retry or mock mode.
- **n8n-to-backend networking.** n8n runs in Docker; to reach the FastAPI host, it uses `http://host.docker.internal:8001` (see `N8N_WHATSAPP_SETUP.md`), not `localhost`.
- **Frontend API base URL.** Configured via `NEXT_PUBLIC_API_URL` (default `http://localhost:8001`). Must be an env var — it's inlined at build time.
- **Dependency versions are pinned and bleeding-edge.** `langchain==0.3.0.dev1`, `langgraph==1.0.10rc1`, `langchain-openai==1.1.14`. Older docs in `LANGGRAPH_AGENTS.md` cite different versions (0.0.29 / 0.1.0) — trust `requirements.txt`. Next.js is `15.5.15` with the App Router.
- **No `.env.example` exists** despite the README referencing one. Environment variables (documented in `ag-associates-ai/README.md` and `DAY3_COMPLETE.md`) must be set manually or defaults in `config.py` will be used (including the checked-in password `secure_password_123`, which is dev-only).

## Git Workflow

- Active dev branch for Claude-driven work: `claude/add-claude-documentation-ULMdm`. Follow the "develop on the designated branch, commit, push" pattern described in the session instructions.
- CI: `.github/workflows/codeql.yml` runs CodeQL on `javascript-typescript` and `python` for pushes/PRs to `main` and weekly on a schedule. No other CI — lint/tests are not enforced.
- The status markers in `ag-associates-ai/README.md` ("Day 1/2/3 ✅/❌") and the `DAY3_COMPLETE.md` / `LANGGRAPH_AGENTS.md` narratives describe the original 72-hour build roadmap. Treat them as historical context, not as a current TODO list.

---

# Workflow Orchestration

## 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

## 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

## 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

## 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

## 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

-----

# Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
1. **Verify Plan**: Check in before starting implementation
1. **Track Progress**: Mark items complete as you go
1. **Explain Changes**: High-level summary at each step
1. **Document Results**: Add review section to `tasks/todo.md`
1. **Capture Lessons**: Update `tasks/lessons.md` after corrections

-----

# Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
