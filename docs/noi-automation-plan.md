# NOI Automation — Complete System Plan

## Agent Orchestration Architecture

### Parallel Execution Design

The NOI automation uses a **fan-out/fan-in LangGraph pattern** instead of sequential pipelines. This enables parallel agent execution at each decision point.

```
                          ┌─────────────────┐
                          │  EMAIL INTAKE   │ ← Sequential entry (IMAP → LLM extraction)
                          │  (single node)  │
                          └────────┬────────┘
                                   │
                     ┌─────────────┼──────────────┐
                     ▼             ▼              ▼
              ┌────────────┐ ┌───────────┐ ┌──────────────┐
              │ DOC        │ │ BANK      │ │ BORROWER     │
              │ VERIFIER   │ │ LOOKUP    │ │ EXTRACT      │ ← FAN-OUT: 3 parallel agents
              │ (OCR+LLM)  │ │ (Supabase)│ │ (LLM parse)  │
              └──────┬─────┘ └─────┬─────┘ └──────┬───────┘
                     │             │              │
                     └─────────────┼──────────────┘
                                   ▼
                          ┌─────────────────┐
                          │ DOC CHECKLIST   │ ← FAN-IN: join results
                          │ (aggregator)    │
                          └────────┬────────┘
                                   │
                          ┌────────┴────────┐
                          ▼                 ▼
                   ┌────────────┐   ┌──────────────┐
                   │ ALL DOCS   │   │ MISSING DOCS │ ← BRANCH: conditional
                   │ PRESENT    │   │              │
                   └──────┬─────┘   └──────┬───────┘
                          │                │
                          ▼                ▼
                   ┌────────────┐   ┌──────────────┐
                   │ GRAS       │   │ AUTO-COMMS   │ ← PARALLEL: RPA + Comms
                   │ CHALLAN    │   │ (send email)  │    can run simultaneously
                   │ (RPA)      │   │              │
                   └──────┬─────┘   └──────────────┘
                          │
                          ▼
                   ┌────────────┐
                   │ IGR NOI    │ ← SEQUENTIAL: wait for challan done
                   │ E-FILING   │
                   │ (RPA)      │
                   └──────┬─────┘
                          │
                          ▼
                   ┌────────────┐
                   │ COMPLETE   │ ← Terminal node
                   │ + NOTIFY   │
                   └────────────┘
```

### LangGraph Implementation

The graph uses LangGraph's **fan-out via `Send`** and **fan-in via reducer**:

```python
from langgraph.graph import StateGraph, Send

class NOIState(TypedDict):
    case_id: str
    email_raw: dict
    doc_verification: dict  # reducer: merge
    bank_info: dict         # reducer: merge
    borrower_info: dict     # reducer: merge
    checklist_result: dict
    challan_grn: Optional[str]
    noi_ack: Optional[str]
    errors: list[str]       # reducer: append
    status: str

def fan_out_doc_verification(state: NOIState) -> list[Send]:
    """Fan-out: run doc verifier, bank lookup, borrower extract in parallel."""
    return [
        Send("verify_docs", {"case_id": state["case_id"], "mode": "ocr"}),
        Send("lookup_bank", {"case_id": state["case_id"]}),
        Send("extract_borrower", {"case_id": state["case_id"]}),
    ]

# Graph construction
builder = StateGraph(NOIState)
builder.add_node("email_intake", email_intake_node)
builder.add_node("verify_docs", doc_verifier_node)
builder.add_node("lookup_bank", bank_lookup_node)
builder.add_node("extract_borrower", borrower_extract_node)
builder.add_node("checklist_join", checklist_joiner_node)
builder.add_node("gras_challan", gras_challan_node)
builder.add_node("igr_filing", igr_filing_node)
builder.add_node("auto_comms", auto_comms_node)
builder.add_node("complete", complete_node)

builder.add_conditional_edges(
    "email_intake",
    fan_out_doc_verification,  # → 3 parallel nodes
    ["verify_docs", "lookup_bank", "extract_borrower"],
)
builder.add_edge(["verify_docs", "lookup_bank", "extract_borrower"], "checklist_join")

builder.add_conditional_edges(
    "checklist_join",
    lambda s: "gras_challan" if s["checklist_result"]["all_present"] else "auto_comms",
)
builder.add_edge("gras_challan", "igr_filing")
builder.add_edge(["igr_filing", "auto_comms"], "complete")
```

### Parallel Execution Guarantees

| Pattern | Mechanism | Benefit |
|---------|-----------|---------|
| **Fan-out** | `Send()` API | 3 checks run simultaneously, not sequentially |
| **Fan-in** | Reducer with `operator.merge` | Joins results without race conditions |
| **Branch** | `add_conditional_edges` | Dead code path never runs |
| **Sequential** | `add_edge` | Critical path (challan→NOI) ordered correctly |
| **Parallel RPA + Comms** | Same Send pattern | Email notification doesn't block RPA |

## Overview

End-to-end NOI (Notice of Intimation) automation for a solo advocate, from bank email intake to final filing. AI handles document verification, automated communication, and portal automation — staff handles OTP entry via Telegram bot.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     NOI AUTOMATION SYSTEM                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐      │
│  │  BANK     │───▶│ EMAIL        │───▶│  AI INTAKE AGENT      │      │
│  │  EMAILS   │    │  INGESTION   │    │  (Extract + Verify)   │      │
│  └──────────┘    └──────────────┘    └───────┬───────────────┘      │
│                                              │                       │
│                    ┌─────────────────────────┼───────────────┐       │
│                    │                         ▼               │       │
│                    │              ┌──────────────────┐       │       │
│                    │              │  DOC VERIFICATION │       │       │
│                    │              │  AGENT            │       │       │
│                    │              │  (OCR + Checklist)│       │       │
│                    │              └────────┬─────────┘       │       │
│                    │                       │                 │       │
│                    │              ┌────────▼────────┐        │       │
│                    │              │  AUTO-COMMS      │        │       │
│                    │              │  AGENT           │        │       │
│                    │              │  (Draft + Send)  │        │       │
│                    │              └────────┬─────────┘        │       │
│                    │                       │                  │       │
│                    │              ┌────────▼────────┐         │       │
│                    │              │  RPA EXECUTOR    │         │       │
│                    │              │  (GRAS + IGR)    │         │       │
│                    │              └────────┬─────────┘         │       │
│                    │                       │                  │       │
│                    │              ┌────────▼────────┐         │       │
│                    │              │  TELEGRAM OTP    │         │       │
│                    │              │  BRIDGE          │         │       │
│                    │              └──────────────────┘         │       │
│                    └──────────────────────────────────────────┘       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐          │
│  │  SOLO ADVOCATE DASHBOARD (React + Tailwind)            │          │
│  │  Pipeline / Inbox / Timeline view of all NOI cases     │          │
│  └────────────────────────────────────────────────────────┘          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agents (Build vs. Existing)

| Agent | Status | Location | Notes |
|-------|--------|----------|-------|
| **Email Intake** | **NEW** | `ag-associates-ai/backend/agents/email_intake.py` | IMAP polling or webhook. Parses bank emails, extracts loan sanction, borrower, property details |
| **Doc Verifier** | **NEW** | `ag-associates-ai/backend/agents/doc_verifier.py` | Scans uploaded docs vs. checklist. Identifies missing items |
| **Auto-Comms** | **NEW** | `ag-associates-ai/backend/agents/auto_comms.py` | Drafts + sends emails for missing docs, progress updates, completion |
| **GRAS RPA** | EXISTS | `executor_agent.py` | Wire real DOM selectors. Extend for NOI-specific challan |
| **IGR RPA** | **NEW** | `executor_agent.py` (extend) | Playwright flow for NOI e-filing on IGR portal |
| **OTP Bridge** | EXISTS | `intake-api` + Redis | Add Telegram bot frontend. Add FIFO queue matching |
| **Telegram Bot** | **NEW** | `ag-associates-ai/backend/telegram_bot.py` | `/otp` commands, OTP delivery to staff |
| **SMS Receiver** | **NEW** | `backend/sms_webhook.py` | Accepts SMS from Android Forwarder, Twilio, or SMS gateway webhooks |

---

## 3. Email Intake

### How bank email becomes a case

```
Bank sends email → ag-associates@email.com
    │
    ▼
Email Intake Agent
    ├── Extracts sender (bank)
    ├── Identifies case type (INTIMATION_MORTGAGE / others)
    ├── Parses email body + attachments for:
    │   ├── Borrower name, loan amount, property details
    │   ├── Loan sanction letter (PDF)
    │   └── Any attached documents
    └── Creates case in Supabase
        └── PENDING_INTAKE status

If email is unclear → AI drafts reply: "Please provide loan sanction letter, borrower PAN, property address"
If email is clear → Auto-creates case, moves to DOCUMENT_COLLECTION
```

### Implementation options

| Option | Pros | Cons |
|--------|------|------|
| **IMAP polling** | No external service | Need always-on process |
| **Resend inbound** | Already have Resend | Paid plan required for inbound |
| **SendGrid inbound** | Popular, predictable | Additional vendor |
| **Cloudflare Email Routing** | Free, no infra | Forwards only, need webhook parser |

**Recommended start:** IMAP polling (self-contained, no extra cost).

---

## 4. Document Verification

### AI scans uploaded docs against required checklist

```
Required for NOI:
  ☐ Loan sanction letter (from bank email)
  ☐ Borrower KYC (PAN card, Aadhaar)
  ☐ Property documents (sale deed, index II)
  ☐ Loan agreement / mortgage deed

Doc Verifier Agent:
  ├── Uses pdfplumber (existing) for text PDFs
  ├── Uses Gemini Vision API (existing in ag-platform) for scanned image PDFs
  ├── Checklist matching → determines PRESENT / MISSING / UNCLEAR
  └── Returns structured result:
      { all_present: bool, missing: string[], unclear: string[] }
```

### If all docs present → auto-proceed to challan
### If docs missing → trigger Auto-Comms Agent

---

## 5. Automated Communication (Auto-Comms Agent)

### Triggers + templates

| Trigger | Recipient | Template |
|---------|-----------|----------|
| Case created | Bank contact | *"NOI case #{id} opened for {borrower}. Docs being verified."* |
| Docs missing | Bank contact | *"Please provide: {list of missing docs} for {borrower}'s NOI."* |
| Docs missing | Borrower | *"Please submit KYC documents for NOI processing at Registrar office."* |
| Challan generated | Bank contact | *"GRAS challan generated for {borrower}: GRN {grn}, ₹{amount}"* |
| Challan paid | Bank contact | *"Challan paid successfully for {borrower}. Proceeding to NOI filing."* |
| NOI filed | Bank contact | *"NOI filed successfully. Acknowledgment: {ack_no}. Case complete."* |
| NOI filed | Borrower | *"Your NOI has been filed. Reference: {ack_no}"* |

### Channel

| Channel | Method | Status |
|---------|--------|--------|
| Email | Resend API (existing in `aiRouter.ts`) | ✅ Exists |
| WhatsApp | n8n → WhatsApp Cloud API (existing) | ✅ Exists |
| SMS | Future | ❌ Add later |

### Implementation

Auto-Comms Agent is a simple state-driven agent:
1. Listens for case status transitions (via Supabase Realtime or webhook)
2. Checks trigger conditions
3. Drafts email via Google Gemini (existing `/draft-email`)
4. Sends via Resend (existing `/send-email`)
5. Logs sent message to `case_timeline` table

---

## 6. OTP Bridge (Telegram + SMS)

### Flow

```
┌──────────────┐     ┌───────────────┐     ┌───────────────┐
│  STAFF      │     │  TELEGRAM BOT │     │  AI AGENT     │
│  (Telegram)  │     │  (@ag_otp_bot) │     │  (FastAPI)    │
└──────┬───────┘     └───────┬───────┘     └───────┬───────┘
       │                     │                     │
       │  /otp gras          │                     │
       │────────────────────▶│                     │
       │                     │  POST /otp/request  │
       │                     │────────────────────▶│
       │                     │                     │──▶ Redis: pending:gras:{staff_id}
       │                     │                     │
       │  (SMS arrives on advocate's phone)        │
       │                     │                     │
       │                     │  POST /sms/webhook  │
       │                     │◀────────────────────│
       │                     │  "GRAS OTP: 123456" │
       │                     │                     │──▶ Parse portal + OTP
       │                     │                     │──▶ Match pending request
       │                     │                     │──▶ Delete Redis key
       │                     │  Send OTP to staff  │
       │                     │────────────────────▶│
       │  🔐 GRAS OTP: 123456│                     │
       │◀────────────────────│                     │
       │                     │                     │
       │  (Staff enters OTP on GRAS portal)        │
```

### SMS ingestion — three supported methods

| Method | How it works | Effort |
|--------|-------------|--------|
| **Android SMS Forwarder** | Install app on advocate's phone → forward all SMS to `POST /sms/webhook` | 5 min setup |
| **Twilio virtual number** | Get Twilio number → SMS forwarded to `POST /sms/webhook` | 30 min setup |
| **SMS Gateway API** | Use provider API → poll or webhook to `POST /sms/webhook` | Depends on provider |

### Telegram Bot commands

| Command | Action |
|---------|--------|
| `/start` | Register staff, link to advocate |
| `/otp` | Request OTP (FIFO — gets next available) |
| `/otp gras` | Request OTP specifically for GRAS portal |
| `/otp igr` | Request OTP specifically for IGR portal |
| `/status` | Show pending OTP requests |
| `/cancel` | Cancel my pending request |

### OTP matching logic (AI reasoning)

```
When SMS arrives: "GRAS OTP: 654321 is your OTP for GRAS"
  → AI agent extracts:
      portal = "gras" (from text "GRAS OTP" / "GRAS")
      code = "654321"

  → Lookup Redis keys matching pending:*:{staff_id}
  → If portal in SMS matches pending request portal → direct match
  → If no portal match → FIFO: send to earliest pending request
  → If no pending requests → store in "orphan" queue
      Staff can later: /claim <otp_code> to claim orphaned OTPs
```

---

## 7. RPA Executor (GRAS + IGR)

### GRAS Challan (exists, needs wiring)

```
GrasRPAExecutor.generate_mtr6_challan(case_id, data)
  ├── Navigate to https://gras.mahakosh.gov.in/echallan/
  ├── Select "Inspector General of Registration"
  ├── Fill NOI challan details:
  │   ├── Borrower name, loan amount
  │   ├── Property details
  │   └── Self-attested bank rep details
  ├── Click "Generate OTP"
  ├── Wait for OTP via Redis polling (existing)
  ├── Enter OTP → Submit
  └── Return GRN (Government Reference Number)
```

**What needs changing:**
- Current executor calculates 0.25% stamp duty for MTR-6 (rental)
- NOI challan = flat ₹1,000 + ₹300 handling = ₹1,300
- Add new method: `generate_noi_challan(case_id, data)`

### IGR E-Filing for NOI (new)

```
IgrRpaExecutor.file_noi(case_id, data, challan_grn)
  ├── Navigate to state IGR e-filing portal (e.g., https://igrmaharashtra.gov.in)
  ├── Login (staff provides credentials via config)
  ├── Select "File Notice of Intimation"
  ├── Fill form:
  │   ├── Borrower name, PAN, Aadhaar
  │   ├── Bank details (name, branch, loan ref)
  │   ├── Property details (address, survey no, sub-registrar jurisdiction)
  │   ├── Loan amount
  │   └── Challan GRN reference
  ├── Upload supporting docs (loan agreement, sanction letter)
  ├── Click "Submit" → portal sends OTP
  ├── Wait for OTP via Telegram bridge
  ├── Enter OTP → Submit
  └── Capture acknowledgment number
```

**Same OTP bridge used for both GRAS and IGR portals.**

---

## 8. Staff Workflow (Day-to-Day)

```
1. Bank emails arrive → AI auto-processes:
   ├── Creates case, extracts details
   ├── Checks docs against checklist
   └── Sends auto-email to bank if docs missing

2. Staff logs into dashboard → sees:
   ├── "4 cases pending verification"
   ├── "2 cases ready for GRAS challan"
   └── "3 NOIs ready to file on IGR portal"

3. Staff clicks "Run RPA" on a case:
   ├── RPA opens GRAS portal, fills form
   ├── Staff receives Telegram: "🔑 Enter GRAS OTP"
   ├── SMS arrives → forwarded → AI routes to staff
   ├── Staff enters OTP → challan generates
   └── Dashboard updates: "✅ Challan paid — GRN: MHR000..."

4. Staff clicks "File NOI":
   ├── RPA opens IGR portal, fills form with challan ref
   ├── Staff receives Telegram: "🔑 Enter IGR OTP"
   ├── SMS arrives → forwarded → AI routes to staff
   ├── Staff enters OTP → NOI filed
   └── Dashboard updates: "✅ NOI filed — Ack: IGR-NOI-..."

5. AI sends completion email to bank with acknowledgment
```

---

## 9. Solo Advocate Dashboard

Three variants built as prototype. Decision pending (see `prototype/noi-dashboard/`).

**Core pages needed:**
- **Dashboard** — Pipeline/inbox/timeline view of all NOI cases
- **Case detail** — Full timeline, docs, comms log, RPA status
- **Staff view** — OTP requests, activity log
- **Settings** — Email config, bank templates, portal credentials

---

## 10. Build Order (Recommended Phases)

### Phase 1 — Foundation (Week 1)
- [ ] Email intake agent (IMAP polling → extract → create case)
- [ ] Documentation verification agent (checklist + OCR + missing doc identification)
- [ ] Auto-Comms agent (email drafting + sending via Resend for missing docs)
- [ ] Dashboard showing pipeline (Variant A or chosen layout)

### Phase 2 — OTP Bridge (Week 2)
- [ ] Telegram bot (`/otp`, `/status`, `/cancel`)
- [ ] SMS webhook endpoint (accept from Android Forwarder / Twilio)
- [ ] AI agent for OTP matching (portal extraction + FIFO queue)
- [ ] Staff-facing view of OTP activity in dashboard

### Phase 3 — RPA (Week 3)
- [ ] Wire GrasRPAExecutor with real DOM selectors for NOI challan
- [ ] Build IgrRpaExecutor for NOI e-filing
- [ ] Connect RPA to OTP bridge (trigger Telegram prompt → wait → continue)
- [ ] Dashboard RPA controls (Run, Status, Logs)

### Phase 4 — Polish (Week 4)
- [ ] WhatsApp notifications (existing n8n infra)
- [ ] Error handling + retry logic for RPA failures
- [ ] Audit log for all automated actions
- [ ] Documentation + staff training guide

---

## 11. Key Decisions (ADRs Needed)

| Decision | Options | Recommended |
|----------|---------|-------------|
| Dashboard layout | Pipeline / Inbox / Timeline | Pipeline (Variant A) — most intuitive for workflow tracking |
| SMS ingestion | Android app / Twilio / Gateway | All three — user chose "all of it" |
| Email ingestion | IMAP / Resend / SendGrid / CF Email | Start with IMAP polling |
| Document OCR | pdfplumber / Gemini Vision / Tesseract | pdfplumber (text) + Gemini Vision (scanned images) — both already in codebase |
| OTP matching | FIFO / Portal-tagged / Broadcast | Portal-tagged with FIFO fallback — accurate + simple |
| Telegram vs WhatsApp | Both | Telegram for OTP bridge (simpler bot API), WhatsApp for client comms (existing n8n) |

---

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Gov portal changes DOM | Screenshot + error alerts; admin playground for manual override |
| OTP not arriving (SMS delay) | Retry with 120s timeout; fallback to staff manual entry |
| Bank email format varies | AI parsing with fuzzy matching; human review flag for unclear emails |
| OCR fails on poor-quality scans | Flag for manual review; Gemini Vision has good degraded-document support |
| Staff not responding on Telegram | Escalate to WhatsApp; timeout → requeue OTP |
