# Architecture Document: AG Associates LegalTech Platform

## 1. Core Data Model

The data model places `Cases` at the center, representing the core unit of work assigned by a bank/NBFC. All tables will include an `org_id` for future multi-tenancy.

### Entities & Relationships

*   **Organizations (`organizations`)**: Represents the top-level tenant (AG Associates).
*   **Users (`users`)**: Represents everyone accessing the system.
    *   Fields: `id`, `org_id`, `name`, `email`, `phone`, `role` (PRINCIPAL, ADVOCATE, EXECUTIVE, CLERK, BANK_VIEWER).
*   **Banks/NBFCs (`banks`)**: The clients paneling AG Associates.
    *   Fields: `id`, `org_id`, `name`, `billing_address`, `contact_persons` (JSONB), `billing_rates` (JSONB).
*   **Borrowers (`borrowers`)**: The end clients of the banks.
    *   Fields: `id`, `org_id`, `bank_id`, `name`, `contact_number`, `email`, `loan_reference_number`.
*   **Properties (`properties`)**: The subject of the legal work.
    *   Fields: `id`, `org_id`, `address`, `survey_cts_number`, `sub_registrar_office_id`, `location_coordinates`.
*   **Cases (`cases`)**: The central operational entity.
    *   Fields: `id`, `org_id`, `case_type` (Search, Vetting, CTC, Registration, etc.), `bank_id`, `borrower_id`, `property_id`, `status`, `sla_deadline`, `assigned_executive_id`, `assigned_advocate_id`, `created_at`, `updated_at`.
*   **Documents (`documents`)**: Per-case document vault.
    *   Fields: `id`, `org_id`, `case_id`, `document_type`, `storage_path`, `received_status` (Pending, Received, Rejected), `uploaded_by`.
*   **Disbursements (`disbursements`)**: Out-of-pocket expenses paid on behalf of clients.
    *   Fields: `id`, `org_id`, `case_id`, `expense_type` (Stamp Duty, Registration Fee, Bribe/Misc), `amount`, `date_paid`, `receipt_storage_path`, `is_reimbursed`, `invoice_id`.
*   **Invoices (`invoices`)**: Monthly or per-case billing to banks.
    *   Fields: `id`, `org_id`, `bank_id`, `invoice_date`, `due_date`, `status` (Draft, Sent, Paid, Overdue), `total_professional_fees`, `total_disbursements`, `tax_amount`.
*   **Sub-Registrar Offices (`sub_registrar_offices`)**: Static reference data.
    *   Fields: `id`, `name`, `location`, `jurisdiction_areas` (JSONB), `timings`, `known_delays_notes`.

---

## 2. Case Lifecycle Architecture (State Machine)

The state machine governs case progression with strict SLA tracking.

### States
*   `RECEIVED`: Initial state when assigned by the bank.
*   `ASSIGNED`: Internal resource (Executive/Advocate) designated.
*   `DOCUMENT_COLLECTION`: Field executive collecting physical docs.
*   `IN_PROGRESS`: Legal desk work (Drafting, Title Search).
*   `PENDING_REGISTRATION`: Awaiting slot at Sub-Registrar.
*   `REGISTERED`: Registration complete, awaiting final docs.
*   `QUALITY_CHECK`: Final review by Principal/Senior Advocate.
*   `DELIVERED`: Final report/docs delivered to the Bank.
*   `INVOICED`: Billing processed.
*   `CLOSED`: Fully resolved and paid.
*   *Exception States*: `ON_HOLD` (Missing info), `REJECTED` (By bank/SRO), `CANCELLED`.

### Transitions & Triggers
*   **RECEIVED → ASSIGNED**: Triggered by `CLERK` or `PRINCIPAL`.
*   **ASSIGNED → DOCUMENT_COLLECTION**: Triggered automatically or by `EXECUTIVE` heading to collection. (Fires WhatsApp to Exec).
*   **DOCUMENT_COLLECTION → IN_PROGRESS**: Triggered by `EXECUTIVE` mapping collected docs.
*   **IN_PROGRESS → PENDING_REGISTRATION / QUALITY_CHECK**: Path forks based on `case_type`. Triggered by `ADVOCATE`.
*   **PENDING_REGISTRATION → REGISTERED**: Triggered by `EXECUTIVE` at SRO.
*   **REGISTERED → QUALITY_CHECK**: Triggered by `EXECUTIVE` submitting registered docs.
*   **QUALITY_CHECK → DELIVERED**: Triggered by `ADVOCATE`/`PRINCIPAL`. (Fires Email/WhatsApp to Bank Contact).
*   **DELIVERED → INVOICED**: Triggered by `CLERK` generating monthly batch.

---

## 3. Tech Stack (India-Ready & Cost-Efficient)

*   **Frontend**: Next.js 15 (App Router) + TypeScript. Styling with Tailwind CSS & shadcn/ui.
*   **Backend/Database**: Supabase (PostgreSQL). Leveraging Row Level Security (RLS) and Edge Functions for serverless compute.
*   **File Storage**: Supabase Storage for legal documents. Private buckets with signed URLs.
*   **Notifications**: WhatsApp Business API (via Meta or Interakt/Wati) for field teams + Resend for official Bank emails.
*   **Payments**: Razorpay gateway for any direct online collections/retainers.
*   **AI Integration**: Google Gemini Pro via Vercel AI SDK. Used for:
    *   Automated Search & Title Report drafting based on historical templates.
    *   OCR and data extraction from scanned 7/12 extracts or Index II documents.
*   **Deployment**: Vercel (Frontends) + Supabase Cloud (ap-south-1 Mumbai region for data sovereignty and low latency).
*   **Monitoring**: Sentry (Errors) + PostHog (Analytics/Usage).

---

## 4. Multi-Tenancy Model

Designed for current single-tenant use with a seamless path to white-labeling SaaS.

*   **Schema Design**: Every table has an `org_id` column.
*   **Enforcement**: Supabase RLS policies enforce tenant isolation at the database level (e.g., `auth.jwt() -> 'app_metadata' -> 'org_id' == org_id`).
*   **Roles (RBAC)**:
    *   **PRINCIPAL**: Full access to all cases, financials, and team management within their `org_id`.
    *   **ADVOCATE**: Access to assigned cases, document generation, and quality checks.
    *   **EXECUTIVE**: Mobile-first view, limited to cases assigned to them, capabilities to upload photos/status updates.
    *   **CLERK**: Administrative access, document inward/outward mapping, invoice generation.
    *   **BANK_VIEWER**: Read-only portal access. RLS scoped by `org_id` AND `bank_id`. Cannot see cases of other banks.

---

## 5. Folder Structure (Turborepo Monorepo)

```text
├── apps/
│   ├── web/                     # Main AG Associates internal app (Next.js)
│   │   ├── src/app/
│   │   │   ├── (auth)/          # Login/Reset
│   │   │   ├── dashboard/       # Principal/Clerk views
│   │   │   ├── cases/           # Case management
│   │   │   └── field-app/       # Mobile-optimized views for Executives
│   │   └── package.json
│   ├── bank-portal/             # Read-only portal for Bank Staff (Next.js)
│   │   ├── src/app/
│   │   │   └── [bank_id]/cases/ # Bank specific views
│   │   └── package.json
├── packages/
│   ├── ui/                      # Shared Tailwind/shadcn components
│   ├── db/                      # Drizzle ORM schemas & migrations
│   ├── types/                   # Shared TypeScript interfaces (Case schemas, etc.)
│   └── ai/                      # Shared Gemini AI prompts & utilities
├── supabase/
│   ├── migrations/              # SQL schema definitions
│   ├── functions/               # Edge Functions (Webhooks, heavy DB tasks)
│   └── seed.sql
├── package.json
└── turbo.json
```

---

## 6. Security Considerations

*   **Data Sovereignty**: Deployment exclusively in AWS `ap-south-1` via Supabase to comply with Indian banking data guidelines.
*   **Document Vault**: 
    *   Documents are stored in a private Supabase bucket.
    *   Access requires strict RLS passing.
    *   Frontend only receives short-lived Signed URLs (e.g., 60-second expiry).
*   **Bank Portal Isolation**: RLS policies explicitly check `auth.uid()` against a `bank_users` mapping table to ensure ICICI staff cannot under any circumstances query Kotak Mahindra cases.
*   **Audit Logging**: Every state transition in the `Cases` table is logged via a PostgreSQL Trigger into a `case_audit_logs` table (immutable insert-only) for compliance.
*   **Executive Access**: Field executives only sync data for cases mathematically assigned to their `executive_id` for the current day.
