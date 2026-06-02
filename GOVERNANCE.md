# AG ASSOCIATES — Project Governance

## Branch Strategy

```
main                     Production-ready code. Protected — no direct pushes.
  │
  ├── feat/<name>        New features
  ├── fix/<name>         Bug fixes
  ├── refactor/<name>    Code restructuring
  ├── docs/<name>        Documentation
  ├── chore/<name>       Build/CI/tooling
  └── perf/<name>        Performance improvements
```

All branches are created from `main`. PRs merge back into `main`.

## Commit Convention

Every commit must follow **Conventional Commits**:

```
<type>(<scope>): <subject>

feat(noi): add email intake agent for bank loan sanctions
fix(ai): handle missing PAN field in document verifier
chore(ci): add Python type checking to CI matrix
```

### Types

| Type | Usage |
|------|-------|
| `feat` | New feature for end-users or systems |
| `fix` | Bug fix |
| `refactor` | Code change with no functional change |
| `perf` | Performance improvement |
| `docs` | Documentation-only changes |
| `style` | Formatting, linting, UI polish |
| `test` | Adding or modifying tests |
| `chore` | Build, CI, dependencies, tooling |
| `revert` | Revert a previous commit |
| `wip` | Work in progress (squash before merge) |

### Scopes

| Scope | Subsystem |
|-------|-----------|
| `ai` | ag-associates-ai/backend — Python agents, LangGraph |
| `dashboard` | ag-associates-ai/frontend — Next.js dashboard |
| `platform` | ag-platform — Turborepo TypeScript |
| `intake` | ag-platform/services/intake-api — Fastify intake |
| `noi` | NOI automation system |
| `rpa` | RPA executor (GRAS/IGR Playwright) |
| `telegram` | Telegram OTP bot |
| `otp` | OTP bridge |
| `comms` | Auto-communication agent |
| `email` | Email intake |
| `docs` | Documentation, ADRs |
| `proto` | Prototypes |
| `ci` | CI/CD workflows |
| `release` | Versioning and releases |

## PR Workflow

1. Create branch from `main` using prefix naming
2. Develop and commit using conventional commits
3. Open PR against `main` — the PR template guides the checklist
4. CI runs automatically: lint → type-check → test → build
5. All CI checks must pass before merge
6. PR requires at least one approval (CODEOWNERS auto-requests)
7. Squash-merge to main (squash commits into one conventional commit message)
8. Delete the feature branch after merge

## Branch Protection (Recommended for `main`)

- Require pull request before merging
- Require status checks: `CI / pre-commit`, `CI / ag-platform`, `CI / ag-associates-ai-backend`
- Require branches to be up to date
- Do not allow bypass above settings
- Include administrators

## Release Process

1. On merge to `main`, a changeset is consumed if present
2. GitHub Action creates a Release PR that bumps versions
3. Merging the Release PR publishes a GitHub Release
4. Deploy workflow triggers automatically for production

## Environment Strategy

| Environment | Branch | Deploy method | URL |
|-------------|--------|---------------|-----|
| Development | Local | `make dev` | localhost |
| Preview | PR branch | GitHub Actions preview | preview-{pr}.ag-associates.pages.dev |
| Production | `main` | Docker + VPS deploy | api.advadiityagade.com |

## Tech Stack Overview

| Subsystem | Language | Framework | Tests |
|-----------|----------|-----------|-------|
| AI Backend | Python | FastAPI + LangGraph | pytest |
| AI Dashboard | TypeScript | Next.js 15 | — |
| Platform | TypeScript | React + Express + Turborepo | Vitest |
| Mobile | TypeScript | Expo + React Native | — |
| Intake API | TypeScript | Fastify + Redis | — |
| NOI Agents | Python | LangGraph + Playwright | pytest |

## Error Escalation

- Tier 1: Automated retry (3 attempts for RPA/OTP)
- Tier 2: Staff notification via Telegram (OTP timeout, RPA failure)
- Tier 3: Advocate notification via WhatsApp + dashboard alert (system error, escalation)
