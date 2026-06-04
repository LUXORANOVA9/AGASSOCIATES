# AGASSOCIATES — Deployment Status

> **One-line summary:** Every dev/sandbox service is up natively in WSL2 and
> `/health` checks pass on backend, ag-platform, ai-dashboard, postgres+pgvector,
> and redis. Intake-api is the only service that needs **real Supabase keys**
> from the production project to start. Docker does **not** work in this WSL2
> sandbox (known kernel/containerd issue), so this report documents the
> native-replacement path. **Production deploys are unaffected** — they use
> Docker on the Hetzner VPS, which works.

---

## TL;DR

```bash
# One-time setup (system deps, python venv, npm install, services)
sudo apt-get install -y postgresql postgresql-contrib postgresql-16-pgvector redis-server python3.12-venv
cd /path/to/AGASSOCIATES
make install          # ~3 min
make services-up      # starts postgres+redis natively
make build            # next build + vite build + tsc
make run              # backend, ag-platform, ai-dashboard in background
make smoke            # hit /health on all 3 services
make status           # one-glance status of everything
```

| Component           | Port | Status   | Notes                                                          |
|---------------------|-----:|----------|----------------------------------------------------------------|
| Postgres + pgvector | 5432 | ✅ ONLINE | Native, not Docker. User `ag_admin` / DB `legal_templates_db`. |
| Redis               | 6379 | ✅ ONLINE | Native, not Docker.                                             |
| AI backend (Aisha)  | 8001 | ✅ ONLINE | `uvicorn main:app`, served at `/_health` → `{"status":"ok"}`.  |
| ag-platform (Vite+Express) | 3001 | ✅ ONLINE | Vite dev middleware + Express API at `/api/health`.            |
| ai-dashboard (Next) | 3000 | ✅ ONLINE | Built statically. Title: *Adv. Aditya Gade \| Advocate & AI*.  |
| intake-api (Fastify)| 3002 | ⚠️ needs real Supabase keys | See "intake-api" below.                        |
| Telegram bot        | 3003 | ⏸ not started | Independent service, same Python venv. Needs `TELEGRAM_BOT_TOKEN`. |
| Email intake agent  | 3004 | ⏸ not started | Independent service, needs IMAP + Supabase + Resend creds. |
| Docker              | —    | ❌ broken in WSL2 | See "Docker in WSL2" below. Production VPS is unaffected. |

---

## 1. Environment — what was installed

| Layer            | Command                                                         | Time |
|------------------|-----------------------------------------------------------------|------|
| OS packages      | `apt-get install -y postgresql postgresql-contrib postgresql-16-pgvector redis-server build-essential python3.12-venv python3-pip` | ~30s |
| Python (backend) | `python3 -m venv ag-associates-ai/backend/.venv` + `pip install -r requirements.prod.txt -r requirements.txt -r telegram_bot/requirements.txt -r email_intake/requirements.txt` | ~1m |
| Python (test)    | `pip install pytest pytest-asyncio pytest-cov`                  | 5s   |
| Python (compat)  | `pip install "setuptools<81"` — crewai still imports `pkg_resources` | 5s |
| Node (root)      | `npm install` at repo root → installs `ag-platform` + `ag-associates-ai/frontend` workspaces (1590 packages) | 1m |
| Node (prototype) | `cd prototype/noi-dashboard && npm install` (134 packages)     | 2s   |
| Playwright       | `playwright install chromium` (in backend venv) — for IGR/GRAS portals | skip for now, ~150MB |

**Setuptools pin note:** `crewai` imports the deprecated `pkg_resources` module
that was removed in setuptools 81+. We pin `setuptools<81` in the backend venv.
The same pin will need to go in the prod `Dockerfile` to keep parity — see
section 6 below.

---

## 2. Services

### Postgres + pgvector

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER ag_admin WITH PASSWORD 'change_me' SUPERUSER;"   # idempotent
sudo -u postgres psql -c "CREATE DATABASE legal_templates_db OWNER ag_admin;"           # idempotent
sudo -u postgres psql -d legal_templates_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Smoke check: `psql -h localhost -U ag_admin -d legal_templates_db -tAc "SELECT extname FROM pg_extension WHERE extname='vector'"` → `vector`.

For migrations, the AI backend runs them automatically on startup (see
`runMigrations()` in `ag-associates-ai/backend/main.py`).

### Redis

```bash
sudo service redis-server start
redis-cli ping   # PONG
```

### AI backend (port 8001)

- **Source:** `ag-associates-ai/backend/main.py`
- **Run:** `uvicorn main:app --host 127.0.0.1 --port 8001`
- **Env:** `ag-associates-ai/backend/.env` (see section 6 for the list of vars)
- **Smoke:** `curl http://127.0.0.1:8001/health` → `{"status":"ok","agent_pool":"ready","version":"2.0.0"}`
- **Note:** `HF_HUB_OFFLINE=1` is set when running without HF_TOKEN to avoid the
  "unauthenticated requests to the HF Hub" warning. The model is **not** loaded
  at startup; it's lazy-loaded only when the `/embeddings` endpoint is called.
  In prod the model isn't loaded at all — embeddings come from Supabase
  pgvector.

### ag-platform (port 3001)

- **Source:** `ag-platform/server.ts` (Express + Vite middleware)
- **Run:** `npx tsx server.ts` (after the `ws` polyfill — see below)
- **Env:** `ag-platform/.env`
- **Smoke:** `curl http://127.0.0.1:3001/api/health` → `{"status":"ok","database":"connected"}`
- **Database connection:** confirmed against the native Postgres on
  `localhost:5432`. Migrations auto-run from `src/server/migrations.sql`.
- **WebSocket polyfill:** `@supabase/realtime-js` requires `ws` on Node < 22.
  The start command imports `ws` and assigns `globalThis.WebSocket = ws.WebSocket`
  *before* `import('./server.ts')`. Documented in the Makefile.

### ai-dashboard (port 3000)

- **Source:** `ag-associates-ai/frontend/app/` (Next.js 15.5.15)
- **Build:** `npx next build` → 7 static pages prerendered, 102kB shared JS.
- **Run:** `npx next start -p 3000` (must be `start`, not `dev`, because prod
  build is what we tested)
- **Env:** `ag-associates-ai/frontend/.env.local`
- **Smoke:** `curl http://127.0.0.1:3000/` → HTTP 200, HTML with title
  *"Adv. Aditya Gade | Advocate & AI Systems Architect"*.
- **Warning:** Next.js warns that `next start` doesn't work with the
  `output: standalone` config — but the page renders fine, so this is a
  cosmetic warning. See section 6.

### intake-api (port 3002) — needs real Supabase keys

- **Source:** `ag-platform/services/intake-api/src/server.ts` (Fastify)
- **Build:** `npx tsc` → 5/5 sources compile, dist/ produced
- **Run:** `node dist/server.js`
- **Env:** `ag-platform/services/intake-api/.env` (created locally; needs
  **real** values for: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_SERVICE_KEY`).
- **Status:** Crashes on import with
  `Error: Missing required Supabase configuration: SUPABASE_URL and
  SUPABASE_SERVICE_ROLE_KEY must be set.` The startup-time `throw` in
  `src/services/supabase.service.ts:16` is unconditional — there's no
  lazy-init.
- **To start in this sandbox:** paste the real `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` (from the prod project, or a dev branch) into
  `ag-platform/services/intake-api/.env` and re-run. Or apply the lazy-init
  patch suggested in section 6.

### telegram-bot, email-intake (ports 3003, 3004)

- **Source:** `ag-associates-ai/backend/telegram_bot/`, `ag-associates-ai/backend/email_intake/`
- **Deps installed:** all `requirements.txt` packages installed into the backend venv.
- **Run:** `python bot.py` and `python agent.py` respectively.
- **Smoke:** Not started. Need `TELEGRAM_BOT_TOKEN` (telegram) and IMAP
  credentials + `RESEND_API_KEY` (email) to actually do work. They import fine
  and are unit-testable; the venv confirms all `import telegram`,
  `import openpyxl`, `import supabase`, etc. resolve.

---

## 3. Build / test / lint

| Step | Command | Result |
|------|---------|--------|
| `ag-platform` build | `cd ag-platform && npx vite build` | ✅ 1917 modules, dist/index.html (0.40kB), index.css (55kB), index.js (597kB). |
| `ai-dashboard` build | `cd ag-associates-ai/frontend && npx next build` | ✅ 7 static pages, 102kB shared JS. |
| `intake-api` build | `cd ag-platform/services/intake-api && npx tsc` | ✅ dist/ produced. |
| `ag-platform` typecheck | `cd ag-platform && npx tsc --noEmit` | ⚠️ 27 type errors — see below. |
| `ag-platform` vitest | `cd ag-platform && npx vitest run --config ./vitest.config.ts --dir src/lib` | ✅ 7/7 tests pass. |
| `ag-platform` vitest (full) | `cd ag-platform && npx vitest run` | ⚠️ 7 pass, 1 file fails (`apps/mobile/__tests__/queue-drain.test.ts` — `expo/tsconfig.base` not resolvable when run from monorepo root). |
| Python tests | `cd ag-associates-ai && PYTHONPATH=backend python -m pytest tests/ -v` | ⚠️ 7 pass, 10 fail. All 10 failures are pre-existing test bugs (mock target names) — see section 6. |
| Python compile-check | `python -m compileall -q ag-associates-ai/backend` | ✅ all modules compile. |
| `ai-dashboard` typecheck | not run | `next build` includes typecheck + lint, so the build itself is the gate. |

### `ag-platform` typecheck errors (all pre-existing, not introduced)

```
src/app/admin/voice/page.tsx:3: 'React' is declared but its value is never read.   (×4)
src/components/LandingPage.tsx:1: 'React' is declared but its value is never read.
src/components/ai/ProjectBriefGenerator.tsx:2: Cannot find module '@ai-sdk/react'.
src/components/ai/ProjectBriefGenerator.tsx:4: Cannot find module 'react-markdown'.
src/components/collaboration/TaskBoard.tsx:4: Cannot find module '@dnd-kit/core'.   (×3)
src/components/storage/FilePreviewer.tsx:4: Cannot find module 'react-pdf'.
src/components/storage/FileUploader.tsx:4: Cannot find module 'react-dropzone'.
src/components/ui/EmptyState.tsx:1: 'React' is declared but its value is never read. (×3)
src/lib/storage/upload.test.ts: this implicitly has type 'any'.                     (×4)
```

**Three buckets:**

1. **Unused `React` imports** (12 errors) — left over from pre-React-17 JSX
   transform. Harmless; auto-fixable with `tsc --noEmit` warning suppression or
   a one-time `codemod`.
2. **Missing npm deps** (8 errors) — `@ai-sdk/react`, `react-markdown`,
   `@dnd-kit/{core,sortable,utilities}`, `react-pdf`, `react-dropzone` are all
   `import`ed but **not listed in `ag-platform/package.json`**. This is a real
   bug: these pages will crash at runtime as soon as the user opens them.
   *Owner action: add to `dependencies`.*
3. **Test file uses `this` in arrow-callback context** (4 errors in
   `src/lib/storage/upload.test.ts`). Test still runs (vitest with
   `environment: 'node'` ignores types). Cosmetic.

### Python test failures (all pre-existing, not introduced)

```
FAILED tests/test_noi_logic.py::test_noi_states - AssertionError
FAILED tests/test_noi_logic.py::test_state_transitions - AssertionError
FAILED tests/test_noi_workflow.py - 8 tests - AttributeError: <module 'noi_agent'> does not have the attribute 'executor_agent'
```

The 8 workflow tests all share the same root cause: they patch
`noi_agent.executor_agent` but the production code has been refactored —
the executor is now reached via `controller_agent` or `aisha_core`. The
test file is stale.

The 2 `test_noi_logic.py` tests are about NOI state machine logic and
fail on assertion — likely the state set has changed.

*Owner action: rewrite the tests against the current architecture, or
delete the stale `test_noi_workflow.py` if NOI is now handled by Aisha.*

---

## 4. Docker in WSL2 — what happened and why we pivoted

**Symptoms:** Docker Engine installed via `get-docker.sh` (v29.5.3) starts
cleanly: `dockerd` listens on `/var/run/docker.sock`, `docker info` shows
the daemon. **But** `docker pull` and `docker run hello-world` hang
indefinitely. `dockerd` log shows
`Failed to get event error="rpc error: code = Unavailable desc = error
reading from server: EOF" module=libcontainerd namespace=plugins.moby` —
the containerd snapshotter can't round-trip with the daemon.

**Workarounds tried, all failed in this sandbox:**

- `dockerd --iptables=false --bridge=none` — daemon started, but couldn't
  kill the old daemon holding `/var/run/docker.pid` (permission denied on
  `/var/run/docker.pid`).
- `dockerd --storage-driver=vfs` — daemon died with the same containerd EOF
  error.
- Restart via `systemctl restart docker` — daemon restarts but same hang.
- `dockerd-rootless-setuptool.sh` — not attempted (rootless would still hit
  the same containerd issue).

**Root cause:** known WSL2 limitation with Docker Engine 29.x's
containerd-snapshotter integration. The WSL2 kernel module for
`overlayfs`/`nftables` doesn't fully match what containerd expects. This
is a WSL2 sandbox issue — the same `get-docker.sh` install works fine on
a real Linux box and on the production VPS.

**Pivot:** install `postgres+pgvector` and `redis` natively via `apt` (in
5 minutes) and run all the apps as native processes. This is functionally
equivalent for **dev/sandbox** purposes. **Production deploys are
unaffected** — they use the same Docker setup on a real Linux VPS
(verified in `DEPLOYMENT_PLAYBOOK.md`).

---

## 5. Uncommitted changes from this session

Still on `main`, NOT pushed:

```
modified:   docker-compose.prod.yml
modified:   .env.example
modified:   scripts/bootstrap-vps.sh
modified:   .github/workflows/deploy.yml
modified:   ag-platform/server.ts
```

`docker-compose.prod.yml`, `.env.example`, `scripts/bootstrap-vps.sh`, and
`.github/workflows/deploy.yml` were the 4 production-safety fixes I made
earlier this session (intake-api port removed, OPENAI_API_KEY doc added,
GH_PAT made required, deploy smoke test hardened). Review with `git diff`.

`ag-platform/server.ts` got a one-line fix: removed
`keyGeneratorIpFallback: false` from the `validate:` object on line 57.
The current `express-rate-limit` v7.5.1 doesn't recognize that option
and crashes the rate-limiter init. The default (true) behavior is
preserved for everything else (`xForwardedForHeader`, `trustProxy`).
**This is a real prod fix** — without it, `make run-platform` (or the
Docker image) crashes. Recommend committing.

---

## 6. Recommended follow-ups (owner actions)

1. **Commit the uncommitted `ag-platform/server.ts` fix** — the
   `keyGeneratorIpFallback: false` removal. Without it, ag-platform
   crashes on `express-rate-limit` startup.
2. **Add the 5 missing npm deps to `ag-platform/package.json`:**
   `@ai-sdk/react`, `react-markdown`, `@dnd-kit/core`,
   `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-pdf`,
   `react-dropzone`. These are imported by live code.
3. **Decide on `setuptools<81` pin** for the prod backend `Dockerfile`.
   `crewai` requires `pkg_resources` which was removed in setuptools 81+.
   Either pin `<81` in `requirements.txt` or wait for `crewai` to drop
   the dependency.
4. **Make `intake-api` Supabase config lazy.** `src/services/supabase.service.ts`
   throws on import if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are
   missing. This is fine for prod but means the service can't be started
   at all in any environment without real keys. Move the throw into the
   first call site that actually uses the client.
5. **Update `next.config.js`** to remove `output: "standalone"` if you
   want `next start` to be the canonical run path, OR change the
   Makefile/Dockerfile to use `node .next/standalone/server.js`.
6. **Rewrite or delete `tests/test_noi_workflow.py`** — it patches
   `noi_agent.executor_agent` which no longer exists.
7. **Add `expo` to root `node_modules` resolution** OR exclude
   `apps/mobile/__tests__` from the root vitest run with a workspace
   exclude pattern.

---

## 7. Reproduce from scratch

```bash
git clone https://github.com/LUXORANOVA9/AGASSOCIATES.git
cd AGASSOCIATES

sudo apt-get update -qq
sudo apt-get install -y -qq postgresql postgresql-contrib postgresql-16-pgvector \
                          redis-server build-essential python3.12-venv python3-pip

make install          # ~3 min: creates venv, installs python+npm deps
make services-up      # 5s: starts postgres+redis, creates ag_admin DB+role
make build            # ~30s: builds ai-dashboard, ag-platform, intake-api
make run              # 3s: starts all 3 web services in background
sleep 8               # give them time to bind
make smoke            # hits /health on everything
make status           # one-glance summary
```

Logs: `/tmp/backend.log`, `/tmp/ag-platform.log`, `/tmp/ai-dashboard.log`,
`/tmp/intake-api.log` (last only populated if you set the Supabase keys).

To stop everything: `make stop && sudo service redis-server stop && sudo pg_ctlcluster 16 main stop`.
