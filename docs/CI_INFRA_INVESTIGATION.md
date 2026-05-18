# CI Infrastructure Investigation

Every pull request on this repo since at least PR #63 has shown an
identical CI failure pattern: 7 of 8 checks fail in 2–3 seconds.
Cloudflare Pages is the only check that succeeds. This document captures
the diagnosis and the fix surface.

## Observed pattern

Sampled across PRs #63, #75, #77, #78, #79, #80, #81, #83 — all show the
same shape:

| Check | Result | Wall time | Source workflow |
|---|---|---|---|
| Cloudflare Pages | ✅ success | <1s | Cloudflare integration (no Actions) |
| Workers Builds: agassociates | ❌ failure | varies | Cloudflare integration |
| Workers Builds: agstaff | ❌ failure | varies | Cloudflare integration |
| Workers Builds: advadityagade | ❌ failure | varies | Cloudflare integration |
| Pre-commit hooks | ❌ failure | **2–3s** | `.github/workflows/main.yml` |
| ag-associates-ai / frontend | ❌ failure | **2–3s** | `.github/workflows/main.yml` |
| ag-associates-ai / backend | ❌ failure | **2–3s** | `.github/workflows/main.yml` |
| ag-platform / turbo | ❌ failure | **2–3s** | `.github/workflows/main.yml` |
| Analyze (python) | ❌ failure | **2–3s** | `.github/workflows/codeql.yml` |
| Analyze (javascript-typescript) | ❌ failure | **2–3s** | `.github/workflows/codeql.yml` |

## Why the 2–3s wall time matters

The four `main.yml` jobs each have these initial steps before any project
code runs:

```yaml
- uses: actions/checkout@v4         # 5–15s
- uses: actions/setup-node@v4       # 5–10s with cache
- run: npm ci                        # 30–90s
```

The fastest possible "succeeded steps + failed run" path is at least
**~10 seconds**. Failures completing in 2–3 seconds **cannot** have
executed even step 1. Whatever fails them is happening before any step
runs.

## Most likely root cause: environment, not code

`git remote -v` shows the repo's origin as
`http://127.0.0.1:<port>/git/LUXORANOVA9/AGASSOCIATES`. This is a local
proxy in front of a sandboxed copy of the repo, not `github.com`. The
"GitHub Actions runs" reported through the GitHub MCP appear to be
**simulated**: they get queued, get a run id, and report immediate
failure for any workflow that requires a real GitHub-hosted runner.

The two checks that succeed in this environment do so because they're
not Actions workflows — they're third-party integrations that have their
own status-API contract (Cloudflare Pages always responds "ok" for these
preview builds; Cloudflare Workers consistently fails because the
build it actually tries is broken — see "Pre-existing Workers builds"
below).

**Verification you can do:**
1. Push the same branch to `github.com/LUXORANOVA9/AGASSOCIATES`
   directly (bypass the local proxy) and observe whether the same 7
   checks still fail in 2–3s.
2. If yes → the issue is in the workflows themselves and the items
   below need fixing.
3. If no → the issue is purely an artifact of this sandbox, and
   shipping these PRs to production CI will reveal a different (and
   probably much smaller) set of real failures.

## Real bugs in the workflows that would matter on `github.com`

Even if the 2–3s pattern is environmental, there are concrete CI issues
worth fixing once the runner question is settled:

### 1. CodeQL action references `@v4` which does not exist

`codeql.yml` lines 71, 100:

```yaml
- uses: github/codeql-action/init@v4
- uses: github/codeql-action/analyze@v4
```

`github/codeql-action` ships major tags `v1`, `v2`, `v3`. There is no
`@v4` as of the date this investigation was written. On a real runner,
this resolves to a 404 / cannot-find-action failure within seconds of
queuing — which would explain the CodeQL analyze jobs failing fast.

**Fix:** pin to `@v3`.

### 2. `deploy.yml` requires secrets that are not configured

`.github/workflows/deploy.yml` references:

- `secrets.PROD_DOMAIN`
- `vars.SUPABASE_URL`
- `secrets.SUPABASE_ANON_KEY`
- (and several more downstream)

If any of these are unset at the org or repo level, the workflow's
matrix expansion still succeeds but the `docker build --build-arg`
step receives empty strings and the image build fails later, not
upfront. Not the 2–3s failure source, but a real failure on the next
`main` push.

**Fix:** audit `Settings > Secrets and variables > Actions` against
the list above and fill any blanks; or short-circuit the workflow with
a step-zero guard that fails loudly if a required var is empty.

### 3. `pre-commit/action@v3.0.1` runs against a config the action
can't satisfy without its dependencies

`main.yml`'s `pre-commit` job runs `actions/setup-python` then jumps to
`pre-commit/action@v3.0.1`, but `.pre-commit-config.yaml` includes:

- `astral-sh/ruff-pre-commit` — needs a Ruff binary downloaded
- `pre-commit/mirrors-eslint` — needs node + a TS/eslint toolchain
  installed via `additional_dependencies`

The Action handles installing pre-commit + its hook environments, so
this should work. But if **the runner cannot reach
`https://github.com` to pull the hook repos**, the job fails very
quickly — within the 2–3s window. Pre-commit's first action is a
`git clone` of each hook repo into its cache.

**Mitigation if outbound access is the constraint:** cache the
pre-commit environments via `actions/cache` keyed on the config file.

### 4. Pre-existing Workers builds always fail

PR #63's description acknowledges this:
> "All CI failures (Cloudflare Workers: agstaff, agassociates,
> advadityagade) are pre-existing on main."

The Workers projects appear to point at code paths in this repo that
no longer exist or don't build. Until somebody owns those projects,
the simplest fix is to **disable the Workers integration** for these
three project slugs in the Cloudflare dashboard, or move them into
a "preview only" mode. They're noisy but ignorable.

## Why merges still happen despite red CI

Looking at recent merged PRs (#61, #67), this repo currently has no
**Required status checks** configured in branch protection — otherwise
nothing could merge to `main`. That's intentional during the build-out
phase but should be revisited before opening the repo to wider
contributors: a green-CI gate is the cheapest defense against
regressions.

## Recommended order to address

1. **Confirm sandbox vs. real CI** by re-running a PR against
   `github.com` directly. Everything below depends on the answer.
2. If real CI is broken: pin CodeQL actions to `@v3` (one-line fix per
   `uses:`).
3. Audit `deploy.yml` secret/var requirements; document the full list
   in `DEPLOYMENT_PLAYBOOK.md`.
4. Decide what to do with the three failing Workers projects — own
   them or disable them.
5. Once the green-CI baseline is real, enable branch protection on
   `main` with required checks: at minimum `ag-platform / turbo`,
   `ag-associates-ai / backend`, `ag-associates-ai / frontend`, and
   the relevant CodeQL languages.

## What this is NOT

This investigation is purely diagnostic — no workflow files were
changed in this PR. Each remediation in the list above belongs in its
own focused PR so reverts stay surgical.
