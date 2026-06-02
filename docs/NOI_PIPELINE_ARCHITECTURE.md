# NOI Pipeline — Full Orchestration Architecture

## Vision

Telegram‑first, AI‑driven, human‑approved. Staff interacts with @ag_associates_bot to manage NOI cases end‑to‑end (intake → challan → portal submission → completion) with agentic parallel execution and human‑in‑the‑loop approvals.

---

## Existing components (already built)

| Component | Status |
|-----------|--------|
| Telegram bot (@ag_associates_bot) | ✅ Running |
| Aisha AI chat (Groq Llama 3.3 70B) | ✅ Running |
| Hindi/English TTS voice mode | ✅ Built |
| OTP bridge (SMS → Redis → Telegram) | ✅ Pipeline ready |
| Android SMS Forwarder setup guide | ✅ Written |
| Excel auditor (finance_auditor.py) | ✅ Built |
| NeSL executor | ✅ Built |
| IGR executor | ✅ Built |
| GRAS executor | ✅ Built |
| Supabase Postgres | ✅ Active |
| n8n workflows | ✅ Configured |
| Caddy + Docker production stack | ✅ Running |

---

## New architecture

```
                    ┌─────────────────────────────────┐
                    │         Telegram Bot             │
                    │   @ag_associates_bot             │
                    │   Commands: /noi /case /task     │
                    └──────────┬──────────────────────┘
                               │
             ┌─────────────────┼──────────────────┐
             ▼                 ▼                   ▼
     ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
     │  Aisha AI   │  │  Task Queue  │  │  OTP Bridge  │
     │  Orchestrator│  │  (Redis)     │  │  (SMS→Group) │
     └──────┬──────┘  └──────┬───────┘  └──────────────┘
            │                │
            ▼                ▼
     ┌─────────────┐  ┌──────────────┐
     │  Agent Pool │  │  RPA Workers │
     │  (parallel) │  │  (sequential)│
     └─────────────┘  └──────────────┘
            │                │
            └───────┬────────┘
                    ▼
            ┌──────────────┐
            │  Supabase DB │
            │  (case data) │
            └──────────────┘
```

---

## Core Workflow — NOI Case Lifecycle

### 1. Intake (Telegram command)
```
Staff sends: /noi new [client_name] [property_details]
Bot creates case in Supabase with status "intake"
```

### 2. Document Collection (semi‑automated)
```
Aisha requests documents from staff:
  - Sale deed, bank statements, ID proof, etc.
  Staff uploads via Telegram (file → bot)
  AI categorizes + extracts first pass of data
```

### 3. Challan Generation (new)
```
Option A — Manual:
  Staff sends /challan <case_id>
  Bot provides challan template, staff enters amount
  System generates PDF and sends to client

Option B — Portal API:
  RPA executor accesses govt portal, enters case details
  Extracts challan PDF, forwards via Telegram

Option C — AI assisted:
  Aisha reads case data, calculates stamp duty + registration fee
  Presents breakdown to staff for approval
  Staff confirms → challan generated
```

### 4. OTP Collection (fully automated)
```
SIM → SMS Forwarder → /api/sms/ingest → Redis → Telegram group
No staff action needed. OTPs appear in the NOI group.
```

### 5. Portal Submission (agentic + parallel)
```
Aisha orchestrator splits into parallel tasks:
  ├── Agent 1: NeSL submission (needs OTP)
  ├── Agent 2: IGR submission (needs OTP)
  ├── Agent 3: GRAS submission (needs OTP)
  └── Agent 4: Status check on previous filings

Each agent:
  a) Checks if OTP is needed
  b) Waits for OTP from bridge (Redis pub/sub)
  c) Completes portal step
  d) Reports status back to Supabase
  e) Notifies Telegram group on completion
```

### 6. Audit & Verification
```
Bot runs /audit on uploaded financial docs
Aisha cross‑checks challan amount vs bank statement
Flags mismatch to staff for review
```

### 7. Completion
```
All tasks done → Bot marks case "completed"
Final summary sent to NOI group + client
Case archived
```

---

## Agentic Parallel Execution

### Orchestrator Agent (Aisha)
- One orchestrator per active NOI case
- Breaks work into tasks, spawns sub‑agents
- Monitors task completion, handles failures
- Escalates to staff when stuck

### Task Agents (parallel)
- Stateless, disposable agents
- Each owns one portal (NeSL/IGR/GRAS) or one subtask (challan, audit, document check)
- Runs in isolated Python subprocess or as separate Docker container
- Communicates via Redis pub/sub + Supabase

### Human‑in‑the‑loop gates
- Challan amount approval
- Document data verification
- Any RPA failure (circuit breaker trips → alert staff)
- Final case close confirmation

---

## Telegram Staff Interface

### New commands needed

| Command | Action |
|---------|--------|
| `/noi new` | Create new NOI case |
| `/noi list` | List active cases |
| `/noi <id>` | Case detail + status |
| `/challan <case_id>` | Generate challan |
| `/task <case_id>` | Show pending tasks |
| `/approve <task_id>` | Approve pending action |
| `/otp <case_id>` | Show OTPs for this case |

### Inline keyboards
- Case detail view: [📄 Docs] [💰 Challan] [📤 Submit] [❌ Close]
- Task list: [✅ Approve] [🔄 Retry] [⏭ Skip] [💬 Comment]

---

## Data Model (Supabase additions)

```sql
CREATE TABLE noi_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT,
  property_details JSONB,
  status TEXT DEFAULT 'intake',
  -- intake, documents, challan, otp_collection, portal_submission, verification, completed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  telegram_group_id BIGINT,
  assigned_staff TEXT
);

CREATE TABLE noi_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES noi_cases(id),
  agent TEXT,  -- 'nesl', 'igr', 'gras', 'challan', 'audit', 'document'
  task_type TEXT,
  status TEXT DEFAULT 'pending',  -- pending, running, awaiting_otp, completed, failed
  payload JSONB,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES noi_cases(id),
  amount DECIMAL,
  pdf_url TEXT,
  status TEXT DEFAULT 'pending',  -- pending, approved, paid
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Implementation phases

### Phase A — Case management (1‑2 days)
- [ ] Create Supabase tables (noi_cases, noi_tasks, challans)
- [ ] Add Telegram commands: `/noi`, `/case`, `/task`
- [ ] Wire bot CRUD to Supabase

### Phase B — Challan pipeline (1‑2 days)
- [ ] /challan command with amount input
- [ ] PDF generation from template
- [ ] Staff approval flow via inline keyboard

### Phase C — Agent orchestrator (2‑3 days)
- [ ] Aisha orchestrator agent for parallel task dispatch
- [ ] Redis‑backed task queue with priority
- [ ] Circuit breakers + failure escalation
- [ ] OTP‑waiting state per agent

### Phase D — n8n integration (1 day)
- [ ] n8n workflow for challan PDF generation
- [ ] Email client communication via n8n
- [ ] SMS alert (optional: Twilio)

### Phase E — Production hardening (2 days)
- [ ] Staff permission levels (viewer, editor, admin)
- [ ] Audit log
- [ ] Case timeline view
- [ ] Backup/restore

---

## Technology stack additions

- **Admin UI** → React/Vite dashboard (already exists as AdvisorCockpit)
- **Task queue** → Redis (already used)
- **PDF generation** → WeasyPrint / ReportLab (new)
- **Agent isolation** → Docker containers per agent (future)
- **Orchestration** → Custom Aisha orchestrator (new)
- **Notifications** → Telegram (existing)
- **Database** → Supabase (existing)

---

## Key design decisions

1. **Telegram is the primary interface**, not the dashboard. Staff works from their phone.
2. **Aisha orchestrates but doesn't execute** — spawns sub-agents, monitors, escalates. Each portal executor is self‑contained.
3. **OTP flow is fully async** — agents block on Redis pub/sub, receive OTP when it arrives, resume automatically.
4. **Every action requires OTP verification** (human approves challan, bot executes on portals with OTP).
5. **Circuit breakers prevent blown credits** — after 3 failures, agent stops and alerts staff.
6. **Parallel where possible** — all portals are independent and can be submitted simultaneously.
