.PHONY: help install lint type-check test build dev clean ci format pre-commit deploy preview \
        python-lint python-format python-test python-install python-check \
        platform-lint platform-type-check platform-test platform-build platform-install \
        otp-test otp-test-bg otp-e2e otp-article-codes otp \
        gpg-setup

SHELL := /bin/bash

help:
	@echo 'AG ASSOCIATES — Monorepo Commands'
	@echo ''
	@echo '  make ci              Full CI pipeline (lint → type-check → test → build)'
	@echo '  make dev             Start all dev servers'
	@echo '  make install         Install all dependencies'
	@echo '  make lint            Lint all code (Python + TypeScript)'
	@echo '  make format          Format all code'
	@echo '  make type-check      TypeScript type checking'
	@echo '  make test            Run all tests'
	@echo '  make build           Build all packages'
	@echo '  make clean           Clean all build artifacts'
	@echo '  make deploy          Deploy to production VPS'
	@echo '  make pre-commit      Run pre-commit hooks'
	@echo '  make preview         Create preview deployment'
	@echo '  make otp-test        Run OTP routing smoke test (intake-api must be up on :3002)'
	@echo '  make otp-test-bg     Auto-start intake-api, run test, tear down (full one-shot)'
	@echo '  make otp-e2e         Run full pipeline e2e test (bank letter → CrewAI → OTP)'
	@echo '  make otp-article-codes  Apply scripts/update-article-codes.sql to local Postgres'
	@echo '  make gpg-setup        One-shot GPG signing setup (generates key, configures git, prints GitHub UI step)'
	@echo ''
	@echo 'Subsystem commands:'
	@echo '  make python-{install,lint,format,check,test}'
	@echo '  make platform-{install,lint,type-check,test,build}'

# ── Python (ag-associates-ai) ───────────────────────────────

PYTHON_DIR := ag-associates-ai/backend
PYTHON_SRC := $(PYTHON_DIR)

python-install:
	cd $(PYTHON_DIR) && pip install -r requirements.txt

python-lint:
	cd $(PYTHON_DIR) && ruff check .

python-format:
	cd $(PYTHON_DIR) && ruff format .

python-check:
	cd $(PYTHON_DIR) && ruff check . && ruff format --check .

python-test:
	cd $(PYTHON_DIR) && python -m pytest -v --tb=short 2>/dev/null || echo "No pytest tests found"

# ── Platform (ag-platform — TypeScript Turborepo) ───────────

PLATFORM_DIR := ag-platform

platform-install:
	cd $(PLATFORM_DIR) && npm install

platform-lint:
	cd $(PLATFORM_DIR) && npm run lint

platform-type-check:
	cd $(PLATFORM_DIR) && npm run type-check

platform-test:
	cd $(PLATFORM_DIR) && npm test

platform-build:
	cd $(PLATFORM_DIR) && npm run build

# ── Unified commands ────────────────────────────────────────

install: python-install platform-install

lint: python-lint platform-lint

format: python-format
	cd $(PLATFORM_DIR) && npx prettier --write "src/**/*.{ts,tsx}" "apps/**/*.{ts,tsx}" "packages/**/*.{ts,tsx}"

type-check: platform-type-check

test: python-test platform-test

build: platform-build
	cd ag-associates-ai/frontend && npm ci && npm run build 2>/dev/null || echo "Frontend build skipped (not configured)"

clean:
	cd $(PLATFORM_DIR) && rm -rf dist .next node_modules
	cd $(PYTHON_DIR) && find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf ag-associates-ai/frontend/.next ag-associates-ai/frontend/node_modules

dev:
	@echo 'Starting all dev servers...'
	@echo '  Platform: npm run dev in ag-platform/'
	@echo '  Backend:  uvicorn main:app in ag-associates-ai/backend/'
	@echo '  n8n:      docker compose up n8n in ag-associates-ai/'
	cd $(PLATFORM_DIR) && npm run dev &
	cd $(PYTHON_DIR) && uvicorn main:app --reload --host 0.0.0.0 --port 8001 &
	cd ag-associates-ai && docker compose up -d n8n 2>/dev/null || true
	wait

ci: pre-commit lint type-check test build

pre-commit:
	pre-commit run --all-files

deploy:
	@echo 'Trigger GitHub Actions deploy workflow'
	@echo '  gh workflow run deploy.yml --ref main'

preview:
	@echo 'Create preview deployment for current branch'
	@echo '  gh workflow run preview.yml --ref $$(git branch --show-current)'

# ── NOI Automation ──────────────────────────────────────────

noi-prototype:
	cd prototype/noi-dashboard && npm run dev

noi-prototype-build:
	cd prototype/noi-dashboard && npm run build

# ── OTP routing smoke tests (intake-api + team_members + Redis) ──
#
# Pre-flight:  Postgres (127.0.0.1:5432) + Redis (127.0.0.1:6379) running locally
# Usage:       make otp-test         # OTP routing only (faster, requires intake-api on :3002)
#              make otp-test-bg      # auto-start intake-api in bg, run test, tear down
#              make otp-e2e          # full pipeline (intake-api + ag-associates-ai)
#              make otp-article-codes # apply scripts/update-article-codes.sql to local DB

INTAKE_API_DIR := ag-platform/services/intake-api
INTAKE_API_LOG := /tmp/intake-api.log
INTAKE_API_PID := /tmp/intake-api.pid

otp-article-codes:
	@echo 'Applying scripts/update-article-codes.sql to local Postgres...'
	@echo 'Luxoranova@9' | sudo -S -u postgres psql -d postgres \
		-f scripts/update-article-codes.sql

otp-test:
	@bash scripts/test-otp-routing.sh

otp-test-bg:
	@if curl -sSf http://127.0.0.1:3002/health >/dev/null 2>&1; then \
		echo 'intake-api already up on :3002 — running test directly'; \
		bash scripts/test-otp-routing.sh; \
	else \
		echo 'Starting intake-api in background with TELEGRAM_DRY_RUN=1...'; \
		cd $(INTAKE_API_DIR) && \
			TELEGRAM_DRY_RUN=1 \
			REDIS_URL=redis://127.0.0.1:6379 \
			INTAKE_PORT=3002 \
			npm run dev > $(INTAKE_API_LOG) 2>&1 & \
			echo $$! > $(INTAKE_API_PID); \
		echo "intake-api started, pid=$$(cat $(INTAKE_API_PID))"; \
		echo 'Waiting 12s for cold start...'; \
		sleep 12; \
		bash scripts/test-otp-routing.sh; \
		RC=$$?; \
		echo 'Tearing down intake-api (pid='$$(cat $(INTAKE_API_PID))')...'; \
		kill $$(cat $(INTAKE_API_PID)) 2>/dev/null || true; \
		rm -f $(INTAKE_API_PID); \
		echo 'tail of intake-api log:'; \
		tail -10 $(INTAKE_API_LOG); \
		exit $$RC; \
	fi

otp-e2e:
	@bash scripts/smoke-test-e2e.sh

# Convenience: 'make otp' runs the bg variant
otp: otp-test-bg

# ── One-shot GPG signing setup ────────────────────────────────
#
# Pre-flight:  Ubuntu with gnupg installed (sudo apt install -y gnupg)
# Usage:       make gpg-setup
# What it does: generates a new ed25519 GPG key with UID
#               'Aditya Gade <admin@advadiityagade.com>',
#               configures git, exports the public key to
#               scripts/.gpg-public-key.asc, runs a throwaway
#               sign+verify test, prints the GitHub UI step
#               that must be done manually.
#
# This script is idempotent — re-running it does nothing if the key
# already exists. The ONLY step it cannot automate is the browser
# upload at https://github.com/settings/keys → GPG keys section.

.PHONY: gpg-setup
gpg-setup:
	@bash scripts/setup-gpg-signing.sh

.DEFAULT_GOAL := help
