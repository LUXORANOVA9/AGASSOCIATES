#!/usr/bin/env bash
set -euo pipefail

log() { printf '\n[setup] %s\n' "$*"; }

REPO_DIR="/workspaces/AGASSOCIATES"

cd "$REPO_DIR"

log "1/7 Installing Python dev tools"
pip install --quiet --upgrade pip
pip install --quiet ruff pre-commit pytest pytest-asyncio pytest-cov

log "2/7 Installing Python project dependencies (no GPU libs)"
pip install --quiet --dry-run -r ag-associates-ai/backend/requirements.txt 2>/dev/null || \
  log "  (dry-run expected to fail for GPU-only deps like torch — this is fine)"

log "3/7 Installing Node.js dependencies"
if [ -f ag-platform/package.json ]; then
  cd ag-platform && npm ci --silent 2>/dev/null && cd "$REPO_DIR" || cd "$REPO_DIR"
fi
if [ -f ag-associates-ai/frontend/package.json ]; then
  cd ag-associates-ai/frontend && npm ci --silent 2>/dev/null && cd "$REPO_DIR" || cd "$REPO_DIR"
fi

log "4/7 Setting up pre-commit hooks"
pre-commit install --install-hooks 2>/dev/null || true

log "5/7 Configuring git"
git config --global --add safe.directory "$REPO_DIR" 2>/dev/null || true

log "6/7 Verifying Docker"
docker info >/dev/null 2>&1 && log "  Docker OK" || log "  Docker not available (will work on push)"


log "7/7 Verifying tools"
echo "  Python:  $(python3 --version)"
echo "  Node:    $(node --version)"
echo "  npm:     $(npm --version)"
echo "  Docker:  $(docker --version 2>/dev/null || echo 'N/A')"
echo "  gh:      $(gh --version 2>/dev/null | head -1 || echo 'N/A')"
echo "  Ruff:    $(ruff --version 2>/dev/null || echo 'N/A')"
echo "  pre-commit: $(pre-commit --version 2>/dev/null || echo 'N/A')"

log "AG Associates Codespaces ready!"
log "Quick start:"
echo "  - Edit code, commit, push"
echo "  - Push to main → auto-deploy to production"
echo "  - Open a PR → CI runs lint + tests"
