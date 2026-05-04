# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x (current) | ✅ |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report security issues via email to [security@agassociates.com](mailto:security@agassociates.com).

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested remediation (if any)

### Response timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix released | Within 30 days (critical) |

### Scope

The following are in scope for security reports:

- **AI Pipeline** (`ag-associates-ai/backend/`) — API endpoints, DB access, LLM interactions
- **Platform** (`ag-platform/`) — Supabase RLS policies, authentication, file storage
- **Infrastructure** — Docker configs, environment variable handling, credential management

### Out of scope

- Mock endpoints (`/api/nesl/execute`) — these simulate government filing and contain no real integrations
- Frontend-only cosmetic issues

## Security Measures

- **Row-Level Security**: Supabase RLS enforces tenant and bank data isolation
- **Signed URLs**: Document vault uses 60-second expiring signed URLs
- **Credential Management**: All secrets via environment variables, never hardcoded in source
- **Audit Logging**: Case state transitions logged to immutable `case_audit_logs` table
- **Data Sovereignty**: Deployed in `ap-south-1` (Mumbai) for Indian banking compliance
