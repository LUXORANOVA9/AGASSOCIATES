# Task Tracking

## Completed ✅

- [x] **Infrastructure** — Docker Compose (PostgreSQL + pgvector + n8n)
- [x] **Database schema** — `legal_templates` with vector(384) + ivfflat index
- [x] **3-node LangGraph pipeline** — Aisha → Drafter → Auditor with revision loop
- [x] **RAG template retrieval** — SentenceTransformer embeddings + pgvector similarity search
- [x] **PDF generation** — ReportLab with Indian legal formatting
- [x] **WhatsApp integration** — n8n webhook → FastAPI → LangGraph
- [x] **NeSL mock filing** — `/api/nesl/execute` with simulated delay
- [x] **Next.js dashboard** — Glassmorphism UI with real-time polling
- [x] **Bug fix: register_vector crashes** — Fixed in agents.py, main.py, generate_embeddings.py
- [x] **Bug fix: RAG random vectors** — Replaced with real SentenceTransformer
- [x] **Bug fix: Embedding dimension mismatch** — Aligned 384 across config, SQL, .env
- [x] **Bug fix: Connection leaks** — Added try/finally in status/templates endpoints
- [x] **Bug fix: OUTPUT_DIR portability** — Relative path instead of hardcoded Linux
- [x] **Bug fix: Dead imports** — Cleaned 12+ unused imports across 3 files
- [x] **AG Platform merge** — Subtree imported case management, bank portal, collaboration
- [x] **Documentation overhaul** — README, CONTRIBUTING, SECURITY, CLAUDE.md redesigned

## Next Up 📋

- [x] **Agent 6: Accountant** — pdfplumber integration for IDBI bank statements + LLM reconciliation
- [ ] **Unify authentication** — Migrate to Supabase Auth across both systems
- [ ] **Pipeline integration** — Case state machine triggers AI agreement generation
- [ ] **Merge PR #18** — CORS middleware for FastAPI backend
- [ ] **Mobile app** — React Native field app for executives
- [ ] **Production NeSL** — Live government registry filing
- [ ] **Test suite** — pytest for backend, vitest for platform
