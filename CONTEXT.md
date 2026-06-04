# AG Associates — Domain Glossary

## Core Terms

### Aisha
Chief of Staff AI agent. Connected exclusively to the Principal / Advocate — not to staff. Serves as the Principal's digital delegate: monitors all cases 24×7, supervises the agent workforce (Vyasa, Drafter, Executor, Auditor, Accountant, Auto-Comms, Doc Verifier, OTP Bridge, V.O.X.), handles financial operations (advance balance, stamp duty payments, bank reconciliation), and communicates via voice/speech-to-speech/text. Per-org singleton — each organization running Luxor9 LegalOS gets its own Aisha instance, bound to that org's Principal.

### Notice of Intimation (NOI)
A mandatory filing under Section 89B of the Registration Act, 1908, submitted to the Sub-Registrar's office within 30 days of home loan disbursement. Notifies the government that a property is mortgaged as collateral. Prevents double-mortgage fraud. 0.3% stamp duty on loan amount (Article 61). E-filing via IGR portal.

### NOI Workflow
End-to-end process: bank emails client documents + advance payment → extract sanction letter (loan amount, property, owner, address) → generate GRAS challan (0.3% stamp duty) → bank sends "NOI drop" go-ahead → rectify any mismatches → bank confirms okay → file NOI on IGR portal → select correct sub-registrar office (Thane has 13) → owner provides Aadhaar/PAN consent → collect acknowledgment.

### NOI Status
Sub-process state machine within a case, stored in `noi_status` column on the `cases` table:
`DOCUMENTS_RECEIVED → CHALLAN_GENERATED → CHALLAN_PAID → VERIFIED → NOI_DROP_RECEIVED → [RECTIFY if mismatch] → NOI_FILED → ACKNOWLEDGED → COMPLETED`
Exception states: `MISMATCH`, `REJECTED`.
Transitions are validated at the application layer by `NOI_TRANSITIONS` in `noi_agent.py`. External webhooks bypass validation via `force=True`.

### Case Status
Primary case lifecycle (12 states, stored in `case_status` column):
`RECEIVED → ASSIGNED → DOCUMENT_COLLECTION → IN_PROGRESS → PENDING_REGISTRATION → REGISTERED → QUALITY_CHECK → DELIVERED → INVOICED → CLOSED`
Exception states: `ON_HOLD`, `REJECTED`.

A case sits at `IN_PROGRESS` while its NOI sub-process runs through the NOI states independently.

### Challan
Government payment receipt generated via the GRAS portal. AG generates the challan (0.3% stamp duty on loan amount), gets it paid, and uses the GRN as proof for NOI filing.

### GRAS Portal
Government Receipt Accounting System — Maharashtra's mandatory platform for stamp duty and registration fee payments.

### IGR Portal
Inspector General of Registration — Maharashtra's e-filing portal where NOI is submitted.

### Sub-Registrar Office
Physical government office where property registrations are filed. Thane has 13 offices; the correct one is selected based on property location.

### GRN
Government Reference Number — 18-digit unique identifier for a challan payment on the GRAS portal.

### Intimation Mortgage
One of 13 case types (`INTIMATION_MORTGAGE`). The core NOI workflow.

### Case Type
One of 13 service offerings: `TITLE_SEARCH`, `LEGAL_VETTING`, `CTC`, `PROPERTY_REGISTRATION`, `MORTGAGE_REGISTRATION`, `INTIMATION_MORTGAGE`, `FRANKING`, `BALANCE_TRANSFER`, `PUBLIC_NOTICE`, `POWER_OF_ATTORNEY`, `LEAVE_AND_LICENSE`, `GIFT_DEED`, `MARKET_VALUATION`.

### Rectify
When bank identifies a mismatch in NOI details (name, amount, address, lender, property) and asks AG to correct and resubmit before final filing.

### NOI Drop
Bank's go-ahead email authorizing AG to proceed with NOI filing on the government portal.

### Owner Consent
Borrower/property owner provides Aadhaar and PAN to authorize NOI filing.

### Sanction Letter
Bank document containing loan amount, borrower name, property address, lender details. AG extracts this data for challan generation and NOI form filling.

### GrasRPAExecutor
Playwright-based automation for the GRAS portal. Generates NOI challan (0.3% stamp duty), handles OTP via Redis bridge, submits challan, returns GRN.

### IgrRpaExecutor
Playwright-based automation for the IGR e-filing portal. Fills NOI form, uploads documents, submits filing after bank go-ahead, returns acknowledgment number.

### OTP Bridge
Redis-mediated pattern for portal authentication OTPs. RPA triggers OTP request → SMS forwarded from phone → AI extracts OTP code → matched to pending request → consumed by RPA. Three SMS sources: Android SMS Forwarder, Twilio, SMS gateway API.

### Telegram Bot
Polling-mode Python bot (`@ag_otp_bot`). Handles `/otp`, `/status`, `/cancel` commands. Staff requests OTP via Telegram → SMS forwarded from phone → AI extracts code → bot delivers to staff.

### Email Intake Agent
IMAP polling daemon. Monitors bank emails, parses sanction letter via LLM, identifies case type, creates case in Supabase.

### Doc Verifier Agent
Scans uploaded documents against NOI checklist (sanction letter, KYC, property docs). Uses pdfplumber for text PDFs + Gemini Vision for scanned images. Returns PRESENT/MISSING/UNCLEAR per item.

### Auto-Comms Agent
Listens for NOI status transitions. Drafts and sends emails for missing docs, challan generated, NOI filed, acknowledgment. Uses Resend API. Templates per trigger.

## Deployment

### Production Stack (VPS Docker Compose)
10 containers: Caddy → PostgreSQL + pgvector + Redis → AI Backend (FastAPI) → AI Dashboard (Next.js) → AG Platform (React+Express) → Intake API (Fastify) → Telegram Bot → Email Intake Agent → n8n (WhatsApp).

### Caddy Routes
- `app.{$DOMAIN}` → ag-platform:3000 (case management)
- `dashboard.{$DOMAIN}` → ai-dashboard:3000 (AI pipeline)
- `api.{$DOMAIN}` → ai-backend:8000 (FastAPI)
- `intake.{$DOMAIN}` → intake-api:3002 (SMS webhook)
- `n8n.{$DOMAIN}` → n8n:5678 (WhatsApp, basic_auth)
- `docs.{$DOMAIN}` → static files

### CI/CD
`deploy.yml` — triggered on `push to main` or manual dispatch. Builds 6 Docker images in matrix on GitHub-hosted runner → pushes to GHCR → self-hosted runner pulls and deploys via `docker compose pull && up -d`. All 10 services have health checks with `depends_on: condition: service_healthy` chains ensuring ordered startup.

## Governance

### Commit Convention
`<type>(<scope>): <subject>`. Types: feat, fix, refactor, perf, docs, style, test, chore, revert, wip. Scopes: ai, dashboard, platform, intake, noi, rpa, telegram, otp, comms, email, docs, proto, ci, release.

### Branch Strategy
`main` protected. Feature branches: `feat/<name>`, `fix/<name>`, `refactor/<name>`, `docs/<name>`, `chore/<name>`, `perf/<name>`. PRs squash-merge.

### Error Escalation
Tier 1: Automated retry (3 attempts for RPA/OTP). Tier 2: Staff notification via Telegram. Tier 3: Advocate notification via WhatsApp + dashboard alert.

## Users / Roles (Hierarchical RBAC)

Python `Role` enum (int, 20–100) at `backend/auth/rbac.py`. Permission inheritance down the hierarchy.

| Role | Level | Permissions |
|------|-------|-------------|
| **PRINCIPAL** | 100 | `firm.manage`, `case.*`, `noi.*`, `comms.*`, `rpa.*`, `reports.*` — full access |
| **ADVOCATE** | 80 | `case.view_all`, `case.assign`, `noi.initiate`, `noi.file`, `noi.generate_challan`, `comms.send_email`, `rpa.run_gras`, `rpa.run_igr`, `reports.view_analytics`, `reports.export` |
| **EXECUTIVE** | 60 | `case.view_assigned`, `case.update_status`, `noi.verify_docs`, `comms.send_whatsapp`, `rpa.view_logs` |
| **CLERK** | 40 | `case.view_assigned`, `noi.view_progress`, `comms.view_log`, `reports.view_dashboard` |
| **BANK_VIEWER** | 20 | `case.view_assigned` — read-only assigned cases |

26 Permission constants across 6 domains: CASE (7), NOI (6), COMMS (3), RPA (3), REPORTS (3), FIRM (4). FastAPI `require_permission()` dependency gates NOI endpoints via `AuthContext` (built from OAuth session cookie + Supabase `profiles.role` lookup). See `backend/auth/deps.py`. Supabase RLS policies use matching Postgres ENUM on `profiles.role`.
