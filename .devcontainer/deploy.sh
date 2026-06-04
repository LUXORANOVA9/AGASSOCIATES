#!/usr/bin/env bash
# One-click deploy from Codespaces — triggers a GitHub Actions workflow run
# Usage: bash .devcontainer/deploy.sh [service]
set -euo pipefail

SERVICE="${1:-}"

echo "==> Triggering deploy for branch: $(git branch --show-current)"
echo "==> Service: ${SERVICE:-all}"

gh workflow run deploy.yml \
  --ref "$(git branch --show-current)" \
  ${SERVICE:+--field service="$SERVICE"}

echo ""
echo "==> Deploy triggered! View at:"
echo "    https://github.com/LUXORANOVA9/AGASSOCIATES/actions/workflows/deploy.yml"
