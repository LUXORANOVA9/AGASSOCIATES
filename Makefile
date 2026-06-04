# AGASSOCIATES — Native Sandbox Makefile
# Reproduces the prod stack natively in WSL2 / any Linux without Docker.
# Production still uses Docker (`docker compose -f docker-compose.prod.yml up -d`)
# on the Hetzner VPS. This Makefile is for the dev/sandbox path.

SHELL := /bin/bash
ROOT  := $(shell pwd)
BACKEND_DIR := ag-associates-ai/backend
PLATFORM_DIR := ag-platform
DASHBOARD_DIR := ag-associates-ai/frontend
INTAKE_DIR := ag-platform/services/intake-api
PROTOTYPE_DIR := prototype/noi-dashboard

# ───────────── meta ─────────────
.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ───────────── install ─────────────
.PHONY: install
install: install-system install-python install-node install-playwright ## Install EVERYTHING

.PHONY: install-system
install-system: ## Install postgres+pgvector and redis via apt
	@echo ">> Installing system deps (postgres, pgvector, redis, python3.12-venv, build-essential)"
	sudo apt-get install -y -qq postgresql postgresql-contrib postgresql-16-pgvector redis-server build-essential python3.12-venv python3-pip

.PHONY: install-python
install-python: ## Create backend venv and install all Python deps
	@echo ">> Creating venv at $(BACKEND_DIR)/.venv"
	cd $(BACKEND_DIR) && python3 -m venv .venv
	@echo ">> Upgrading pip + installing prod + dev + sub-service deps"
	cd $(BACKEND_DIR) && . .venv/bin/activate && \
	  pip install --upgrade pip -q && \
	  pip install -r requirements.prod.txt -q && \
	  pip install -r requirements.txt -q && \
	  pip install -r telegram_bot/requirements.txt -q && \
	  pip install -r email_intake/requirements.txt -q && \
	  pip install "setuptools<81" -q && \
	  pip install pytest pytest-asyncio pytest-cov -q
	@echo ">> Done. Activate with: source $(BACKEND_DIR)/.venv/bin/activate"

.PHONY: install-node
install-node: ## npm install at root (drives the whole monorepo via workspaces)
	@echo ">> npm install at repo root (drives ag-platform + ai-dashboard via workspaces)"
	npm install --no-audit --no-fund
	@echo ">> npm install for prototype (noi-dashboard)"
	cd $(PROTOTYPE_DIR) && npm install --no-audit --no-fund

.PHONY: install-playwright
install-playwright: ## Install Playwright Chromium for IGR/GRAS portal automation
	cd $(BACKEND_DIR) && . .venv/bin/activate && playwright install chromium

# ───────────── services ─────────────
.PHONY: services-up
services-up: postgres-up redis-up ## Bring up postgres + redis natively

.PHONY: services-down
services-down: ## Stop postgres + redis
	sudo service redis-server stop
	sudo pg_ctlcluster 16 main stop

.PHONY: postgres-up
postgres-up: ## Start postgres cluster and create ag_admin/legal_templates_db
	@echo ">> Starting postgres"
	pg_lsclusters | grep -q "16 main.*online" || sudo pg_ctlcluster 16 main start
	@echo ">> Creating ag_admin role + legal_templates_db (idempotent)"
	sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='ag_admin'" | grep -q 1 || \
	  sudo -u postgres psql -c "CREATE USER ag_admin WITH PASSWORD 'change_me' SUPERUSER;"
	sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='legal_templates_db'" | grep -q 1 || \
	  sudo -u postgres psql -c "CREATE DATABASE legal_templates_db OWNER ag_admin;"
	sudo -u postgres psql -d legal_templates_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

.PHONY: redis-up
redis-up: ## Start redis
	sudo service redis-server start

# ───────────── build ─────────────
.PHONY: build
build: build-frontend build-platform build-intake ## Build every frontend bundle

.PHONY: build-frontend
build-frontend: ## next build for ai-dashboard
	cd $(DASHBOARD_DIR) && npx next build

.PHONY: build-platform
build-platform: ## vite build for ag-platform
	cd $(PLATFORM_DIR) && npx vite build

.PHONY: build-intake
build-intake: ## tsc build for intake-api
	cd $(INTAKE_DIR) && npx tsc

# ───────────── lint / typecheck ─────────────
.PHONY: lint
lint: lint-py lint-ts ## Lint everything

.PHONY: lint-py
lint-py: ## Compile-check all Python files
	cd $(BACKEND_DIR) && . .venv/bin/activate && \
	  python -m compileall -q . 2>&1 | tail -5

.PHONY: lint-ts
lint-ts: ## tsc --noEmit on ag-platform (excludes @ag/mobile — RN type conflicts)
	cd $(PLATFORM_DIR) && npx tsc --noEmit 2>&1 | tail -20

# ───────────── test ─────────────
.PHONY: test
test: test-py test-ts ## Run every test suite

.PHONY: test-py
test-py: ## pytest for AI backend
	cd $(BACKEND_DIR) && . .venv/bin/activate && \
	  cd .. && PYTHONPATH=backend python -m pytest tests/ -v --no-header 2>&1 | tail -30

.PHONY: test-ts
test-ts: ## vitest for ag-platform (excludes @ag/mobile which needs Expo runtime)
	cd $(PLATFORM_DIR) && npx vitest run --config ./vitest.config.ts --dir src/lib 2>&1 | tail -20

# ───────────── run (dev) ─────────────
.PHONY: run
run: run-backend run-platform run-dashboard ## Run all 3 web services natively in background

.PHONY: run-backend
run-backend: ## Run AI backend (uvicorn) on :8001
	cd $(BACKEND_DIR) && . .venv/bin/activate && \
	  HF_HUB_OFFLINE=1 setsid nohup python -m uvicorn main:app \
	    --host 127.0.0.1 --port 8001 --log-level info \
	    > /tmp/backend.log 2>&1 < /dev/null & disown
	@echo "AI backend → http://127.0.0.1:8001/health  (log: /tmp/backend.log)"

.PHONY: run-platform
run-platform: ## Run ag-platform (Express+Vite) on :3001 with WebSocket polyfill
	cd $(PLATFORM_DIR) && setsid nohup npx tsx -e \
	  "import ws from 'ws'; globalThis.WebSocket = ws.WebSocket; import('./server.ts');" \
	  > /tmp/ag-platform.log 2>&1 < /dev/null & disown
	@echo "ag-platform → http://127.0.0.1:3001/api/health  (log: /tmp/ag-platform.log)"

.PHONY: run-dashboard
run-dashboard: ## Run ai-dashboard (next start) on :3000
	cd $(DASHBOARD_DIR) && setsid nohup npx next start -p 3000 \
	  > /tmp/ai-dashboard.log 2>&1 < /dev/null & disown
	@echo "ai-dashboard → http://127.0.0.1:3000/  (log: /tmp/ai-dashboard.log)"

# ───────────── stop ─────────────
.PHONY: stop
stop: ## Stop all 3 web services
	-pkill -f "uvicorn main:app" || true
	-pkill -f "tsx.*server.ts" || true
	-pkill -f "next-server" || true
	-pkill -f "next start" || true
	@echo "stopped"

# ───────────── smoke ─────────────
.PHONY: smoke
smoke: ## Hit /health on every service
	@echo "[1/5] AI backend ............." $$(curl -sS -m 3 http://127.0.0.1:8001/health)
	@echo "[2/5] ag-platform ..........." $$(curl -sS -m 3 http://127.0.0.1:3001/api/health)
	@echo "[3/5] ai-dashboard .......... HTTP $$(curl -sS -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
	@echo "[4/5] postgres+pgvector ....." $$(PGPASSWORD=change_me psql -h localhost -U ag_admin -d legal_templates_db -tAc "SELECT current_database() || ' / ' || extname FROM pg_extension WHERE extname='vector'")
	@echo "[5/5] redis ................." $$(redis-cli ping)

# ───────────── clean ─────────────
.PHONY: clean
clean: clean-venv clean-node clean-build clean-logs ## Remove ALL generated artifacts

.PHONY: clean-venv
clean-venv:
	rm -rf $(BACKEND_DIR)/.venv

.PHONY: clean-node
clean-node:
	rm -rf node_modules $(PLATFORM_DIR)/node_modules $(DASHBOARD_DIR)/node_modules $(PROTOTYPE_DIR)/node_modules

.PHONY: clean-build
clean-build:
	rm -rf $(PLATFORM_DIR)/dist $(DASHBOARD_DIR)/.next $(INTAKE_DIR)/dist

.PHONY: clean-logs
clean-logs:
	rm -f /tmp/backend.log /tmp/ag-platform.log /tmp/ai-dashboard.log /tmp/intake-api.log

# ───────────── status ─────────────
.PHONY: status
status: ## Print deployment status summary
	@echo "=== AGASSOCIATES local status ==="
	@echo "Docker:    " $$([ -S /var/run/docker.sock ] && echo "socket present (broken in this WSL2)" || echo "absent")
	@echo -n "Postgres:   "; (pg_lsclusters 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | grep -q "^16.*main.*online" && echo "ONLINE") || echo "OFFLINE"
	@echo -n "Redis:      "; ([ "$$(redis-cli ping 2>/dev/null)" = "PONG" ] && echo "ONLINE") || echo "OFFLINE"
	@echo -n "AI backend (8001): "; (curl -sS -m 2 http://127.0.0.1:8001/health 2>/dev/null | grep -q '"status":"ok"' && echo "ONLINE") || echo "OFFLINE"
	@echo -n "ag-platform (3001):"; (curl -sS -m 2 http://127.0.0.1:3001/api/health 2>/dev/null | grep -q '"status":"ok"' && echo "ONLINE") || echo "OFFLINE"
	@echo -n "ai-dashboard (3000):"; ([ "$$(curl -sS -m 2 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ 2>/dev/null)" = "200" ] && echo "ONLINE") || echo "OFFLINE"
	@echo "intake-api (3002):  needs real Supabase keys — see DEPLOYMENT_STATUS.md"
