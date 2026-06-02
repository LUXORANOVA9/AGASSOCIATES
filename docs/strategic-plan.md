# Strategic Action Plan & To-Do List

Generated from deep analysis of the complete AG Associates monorepo architecture (AI backend, React Native mobile app, Next.js platform, Supabase migrations).

## 🔴 High Priority: RPA & Portal Resilience

- [ ] **RPA Circuit Breakers & Human Fallbacks** — Redis-backed stateful circuit breaker for `executor_agent.py` when portals (`igr_executor.py`, `gras_client.py`) encounter consecutive fatal errors (3 failures in 10 min). Reroute to HITL queue visible in `AdvisorCockpit.tsx`.
- [ ] **Dynamic Selector Management** — Move 18 hardcoded Playwright selectors from `igr_executor.py` into Supabase config table or Redis cache for live updates without redeployment.
- [ ] **Automated Visual Regression Testing** — GitHub Actions nightly dummy runs against staging/sandbox endpoints to detect government portal UI shifts before production impact.

## 🔴 High Priority: Financial Webhooks & Voice System Security

- [ ] **Strict Payment Webhook Validation** — Enforce cryptographic signature verification in `payment/webhook.py` and `n8n_webhook.py`. Ensure idempotency keys prevent replay attacks.
- [ ] **Vyasa Voice Command Risk Overrides** — Implement mandatory "Risk Level" threshold. High-risk voice commands (bulk refunds, case deletions) require secondary MFA confirmation before `voice_command_logs` trigger execution.

## 🟡 Medium Priority: Field App & Offline Sync

- [ ] **Advanced Conflict Resolution** — Enhance `useMutationQueue.ts` with field-level merging for cases edited concurrently offline (field executive) and online (admin dashboard).
- [ ] **TUS Resumable Upload Idempotency** — Ensure `client-event-id` deduplication syncs with local SQLite offline queue to prevent orphaned artifacts in Supabase Storage on crash recovery.
- [ ] **Battery & Data Optimization** — Refactor `useOnDutyTracker.ts` GPS ping frequency based on accelerometer state; minify payloads for cellular efficiency.

## 🔵 Medium Priority: AI Safety & Agent Ops

- [ ] **Hallucination Guidelines Enforcement** — Implement checks from `HALLUCINATION_MITIGATION_GUIDELINES.md`. Auditor agent cross-examines Scribe agent outputs before `pdf_generator.py` compiles final PDF.
- [ ] **Activate Bouncer Agent** — Insert `agents/bouncer.py` into NOI pipeline to validate stamp duty calculations (~0.3% rent × duration, ±₹50 tolerance) before payment intent finalization.
- [ ] **Granular Token Auditing & Cost Tracking** — Implement soft/hard quota limits per tenant from `ai_token` tracking. Auto-alert at 80% monthly allocation.

## 🟢 Low Priority: DevOps & Infrastructure

- [ ] **Caddy Reverse-Proxy Hardening** — Rate limiting at Caddy layer for n8n/intake subdomains before requests reach FastAPI/Fastify servers.
- [ ] **Supabase RLS Audit** — Exhaustive audit of PostgreSQL RLS policies in `document_storage_setup.sql` and `workforce.sql`.
- [ ] **Automated Credential Rotation** — Zero-touch rotation schedule for government portal credentials (NeSL, IGR, GRAS).
