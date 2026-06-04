# ADR 0001: Monorepo Orchestration Strategy

## Status

Accepted

## Context

The AG ASSOCIATES repository contains two independent software stacks:

- **Python stack** (ag-associates-ai/): FastAPI backend, LangGraph agents, Playwright RPA, CrewAI pipelines
- **TypeScript stack** (ag-platform/): Turborepo with React + Express, plus ag-associates-ai/frontend (Next.js)

Before this ADR, there was no unified orchestration. The two stacks lacked shared CI, consistent commit conventions, or coordinated deployment workflows. Each subsystem had its own lint/test commands. PR quality gates were inconsistent.

## Decision

We adopt a **dual-orchestration model**:

1. **Root Makefile** coordinates all subsystem commands locally (`make ci`, `make lint`, `make test`)
2. **GitHub Actions matrix CI** runs all subsystems in parallel with independent jobs
3. **Turborepo** manages the TypeScript workspace (ag-platform + ag-associates-ai/frontend)
4. **Conventional Commits** with scoped types (e.g., `feat(noi): `) provide a single commit standard across both stacks
5. **Changesets** manage version bumps and changelog generation

### Why not force everything into Turborepo?

Turborepo is designed for JavaScript/TypeScript. Python tools (ruff, pytest, pip) don't integrate natively. Forcing Python through Turborepo task wrappers adds indirection without meaningful caching benefits. The Makefile + CI matrix approach gives us parallel execution and gate-keeping without fighting the tool.

### Why Conventional Commits for both stacks?

Both stacks ship as part of the same product. A single changelog that tracks both Python agent changes and TypeScript UI changes is more useful than separate histories. The scope prefix (e.g., `ai`, `platform`, `noi`) disambiguates which subsystem a commit targets.

## Consequences

### Positive

- One `make ci` command validates the entire repository
- PR template ensures consistent quality gates across both stacks
- CODEOWNERS automatically requests reviews for the right subsystem
- Preview deployments available per PR for visual review
- Changesets enable automated versioning and release notes
- Commit convention enforced in CI prevents bikeshedding in PR review

### Negative

- Developers must learn conventional commit format
- Changesets add a file-per-PR overhead (mitigated by automation in CI)
- Preview deployments require Cloudflare Pages API token in CI secrets

### Risks

- Makefile must be kept in sync as new subsystems are added
- CI matrix can grow expensive if many jobs run in parallel (mitigated by `fail-fast: false` only for core jobs)
- Branch protection rules require manual setup in GitHub repo settings
