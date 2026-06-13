# CI Infrastructure Investigation

Every pull request on this repo since at least PR #63 has shown an
identical CI failure pattern: 7 of 8 GitHub Actions checks fail in 2–3
seconds. Cloudflare Pages is the only check that consistently succeeds.
This document captures the diagnosis and the fix surface.

> **Update — 2026-05-19:** The original version of this document
> reached a partly-wrong conclusion (it blamed a non-existent CodeQL
> `@v4` major tag and a sandbox-specific `127.0.0.1` git remote).
> Codex review caught both. The verified root cause is account-level
> GitHub billing lock — see below. The original incorrect sections
> have been removed.

## Observed pattern

Sampled across PRs #63, #75, #77, #78, #79, #80, #81, #83, #84, #85 —
all show the same shape:

| Check | Result | Wall time | Source |
|---|---|---|---|
| Cloudflare Pages | ✅ success | <1s | Cloudflare integration |
| Workers Builds: agassociates | ❌ failure | varies | Cloudflare integration (pre-existing, see below) |
| Workers Builds: agstaff | ❌ failure | varies | Cloudflare integration (pre-existing, see below) |
| Workers Builds: advadityagade | ❌ failure | varies | Cloudflare integration (pre-existing, see below) |
| Pre-commit hooks | ❌ failure | **2–3s** | `.github/workflows/main.yml` |
| ag-associates-ai / frontend | ❌ failure | **2–3s** | `.github/workflows/main.yml` |
| ag-associates-ai / backend | ❌ failure | **2–3s** | `.github/workflows/main.yml` |
| ag-platform / turbo | ❌ failure | **2–3s** | `.github/workflows/main.yml` |
| Analyze (python) | ❌ failure | **2–3s** | `.github/workflows/codeql.yml` |
| Analyze (javascript-typescript) | ❌ failure | **2–3s** | `.github/workflows/codeql.yml` |

## Root cause: account-level billing lock

The GitHub Actions Annotations on every failed job in this repo show a
single, identical line:

> **"The job was not started because your account is locked due to a
> billing issue."**

Verified verbatim on three independently-sampled job pages during this
investigation:

- PR #75 → run `26092307016/job/76720887754` (ag-associates-ai / backend)
- PR #75 → run `26092306890/job/76720887372` (Analyze (python))
- PR #75 → run `26091844937/job/76719275098` (Analyze (python), older run)

All six GitHub-hosted-runner jobs are rejected at queue admission —
before any step, before runner allocation. That is why the wall time is
under 5 seconds for every job regardless of what it would have run
(the pre-commit job has no Node/npm step, the backend job has no Node
at all; the timing is uniform because none of them actually start).

The Cloudflare Pages check is unaffected because it doesn't run on
GitHub-hosted Actions infrastructure.

## Remediation

The fix is account-side, not repo-side. No workflow file change will
clear it.

1. Open **https://github.com/settings/billing** (or the org-level
   billing page if the repo is billed to an org).
2. Resolve the outstanding charge — typically one of:
   - Failed payment method / expired card. Update and retry the
     invoice.
   - **Spending limit set to $0.** Settings → Billing → "Spending
     limits" → raise the Actions cap (or set unlimited).
   - **Actions disabled at the repo or org level.** Settings → Actions
     → General must be set to "Allow all actions and reusable
     workflows". An admin can flip this off during a billing dispute
     and forget to flip it back.
3. Push any commit afterwards. The Actions queue will admit it on the
   next trigger; no workflow file changes required.

Propagation typically clears within a few minutes, but a failed
invoice that GitHub's billing system needs to retry can take 15–30 min.

## Pre-existing Cloudflare Workers builds (separate, also red)

The three `Workers Builds: agstaff / agassociates / advadityagade`
checks fail in **0 seconds** — different platform, different cause.
PR #63's description acknowledges they have been red on `main` since
before that PR. They go through `dash.cloudflare.com` and don't share
state with GitHub Actions. Triage these after billing is unlocked,
since fixing them may need CI artifacts that aren't being produced
right now.

## Why merges still happen despite red CI

Looking at recent merged PRs (#61, #67), this repo currently has no
**Required status checks** configured in branch protection — otherwise
nothing could merge to `main` while the lock holds. That's pragmatic
during a billing outage but should be re-enabled once a green-CI
baseline exists.

## Follow-ups unrelated to the 2–3s pattern

These are real CI hygiene items, separate from the billing issue. They
won't surface until after billing clears, but are worth tracking:

- **`deploy.yml` secret/var audit.** `Settings → Secrets and variables
  → Actions` should be checked against everything `deploy.yml`
  references (`PROD_DOMAIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`, `GITHUB_TOKEN`).
  Missing values silently produce empty `--build-arg` strings rather
  than failing upfront.
- **Cloudflare Workers cleanup.** Either own and fix `agstaff` /
  `agassociates` / `advadityagade` builds in the Cloudflare dashboard
  or detach the GitHub integration for the broken slugs.

## Recommended order to address

1. **Unlock billing** at the GitHub settings page above. Confirm by
   pushing an empty commit and observing whether the next set of
   check runs gets past the 5-second mark.
2. Once Actions runs are admitting jobs, run a real CI pass and
   triage any genuine workflow failures that surface (separate from
   the billing-lock symptom).
3. Audit `deploy.yml` secret/var requirements; document the full list
   in `DEPLOYMENT_PLAYBOOK.md`.
4. Decide what to do with the three failing Workers projects — own
   them or disable them.
5. Once green-CI is real, enable branch protection on `main` with
   required checks: at minimum `ag-platform / turbo`,
   `ag-associates-ai / backend`, `ag-associates-ai / frontend`, and
   the relevant CodeQL languages.

## What this is NOT

This investigation is purely diagnostic — no workflow files were
changed in this PR. Each remediation in the list above belongs in its
own focused PR so reverts stay surgical.

## Sections removed from the original revision

For posterity, the v1 of this document made three claims that turned
out to be wrong; they have been removed:

1. **"`github/codeql-action@v4` does not exist."** It does — published
   2026-05-15. Pinning back to `@v3` would be a regression.
2. **"The 2–3s wall time is faster than `actions/checkout` +
   `setup-node` + `npm ci` can run, so failure must precede step 1."**
   The premise applied unevenly — the pre-commit job uses
   `pre-commit/action`, the backend job uses `pip` with no Node, and
   the CodeQL jobs use the CodeQL action. The conclusion happened to
   be correct (failure does precede step 1) but for an unrelated
   reason: queue-admission rejection due to billing lock.
3. **"This repo's git origin is `127.0.0.1`, so failures are
   sandbox-simulated."** That was the author's transient checkout
   configuration, not committed repo state. Failures are real GitHub
   Actions failures on real github.com infrastructure.
