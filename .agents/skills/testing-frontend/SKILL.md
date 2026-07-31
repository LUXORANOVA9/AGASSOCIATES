---
name: testing-frontend
description: How to set up and test the AG Associates frontend (ag-platform) locally and via Cloudflare Pages preview deployments.
---

# Testing the AG Associates Frontend

## Network Requirements

Devin sessions with restricted network policies need these domains allowlisted:
- `registry.npmjs.org` — for `npm install`
- `*.pages.dev` — for Cloudflare Pages preview deployments

Add via the session's ⋯ menu → Network Config.

## Local Development Setup

```bash
cd ag-platform
npm install          # installs all deps including Vite, React, etc.
npx vite dev         # starts dev server on http://localhost:5173
```

Build tool: **Vite** (configured in `ag-platform/vite.config.ts`)
Path alias: `@` → `./src`

## Cloudflare Pages Previews

Every PR branch gets an automatic Cloudflare Pages deployment. The preview URL appears in the PR comments from `cloudflare-workers-and-pages[bot]`. Format:
- Preview URL: `https://<hash>.agassociates.pages.dev`
- Branch URL: `https://<branch-name>.agassociates.pages.dev`

## Application Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | MarketingLanding | Marketing landing page |
| `/applicant` | ApplicantDashboard | Applicant portal |
| `/admin` | AdvisorCockpit | Banker's Eye Kanban (5 columns) |
| `/field` | FieldApp | Field Executive PWA (offline-first) |
| `/bank` | BankPortal | Bank portal |

Routes defined in `ag-platform/src/App.tsx`.

## Key Components to Test

### Kanban Board (`/admin`)
- File: `ag-platform/src/components/admin/AdvisorCockpit.tsx`
- Fetches cases from `GET /api/cases` on mount
- Without a backend, shows "Connection Error" with "Retry Connection" button
- With backend, shows 5 columns: Intake, OCR Processing, Validation, Awaiting Human Review, Ready for IGR
- Supports optimistic status updates via `PATCH /api/cases/{id}`

### Field Executive PWA (`/field`)
- File: `ag-platform/src/components/field/FieldApp.tsx`
- Dark-themed (bg-slate-900) mobile-optimized layout
- Works standalone with hardcoded mock case data (3 cases: AGA-2024-00123 through 00125)
- Online/offline indicator using `navigator.onLine`
- Camera capture → offline sync queue stored in localStorage (`field_offline_queue`)
- No backend required for basic UI testing

## Backend (Optional for Frontend Testing)

```bash
cd ag-associates-ai/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py   # FastAPI on port 8001
```

Case API endpoints (require auth via `Depends(get_current_user)`):
- `GET /api/cases`
- `PATCH /api/cases/{case_id}`
- `PUT /api/cases/{case_id}/status`

CORS allows: GET, POST, PUT, PATCH, DELETE, OPTIONS

## CI/CD

- **Cloudflare Pages**: Auto-deploys on every push (the main CI check that matters for frontend)
- **Cloudflare Workers**: 3 worker projects that may fail due to config issues (not related to frontend code)
- **GitHub Actions**: Blocked by billing lock on LUXORANOVA9 account as of May 2026
- **CodeQL**: Runs on push/PR to main (when Actions are unblocked)

## Test Strategy

For frontend-only testing (no backend):
1. Navigate to `/admin` — verify Kanban error state renders (proves component compiled)
2. Navigate to `/field` — verify PWA renders with case dropdown and camera UI
3. Navigate to `/` — verify marketing page (regression)
4. Check nav bar has 5 links: Marketing, Applicant, Advisor, Field Ops, Bank Portal

For full-stack testing: start the FastAPI backend first, then verify `/admin` shows case data in Kanban columns.
