#!/usr/bin/env bash
# Setup a GitHub Actions self-hosted runner for AG Associates VPS.
# Can be run as root (from bootstrap-vps.sh) or as the deploy user directly.
#
# Usage as root:   bash scripts/setup-runner.sh <github-pat> <deploy-user>
# Usage as deploy: bash scripts/setup-runner.sh <github-pat>
set -euo pipefail

REPO="LUXORANOVA9/AGASSOCIATES"
RUNNER_DIR="/home/deploy/actions-runner"
SERVICE_NAME="actions.runner.$(echo "$REPO" | tr '/' '-').$(hostname)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <github-pat> [deploy-user]"
  echo "The PAT needs repo scopes to generate the runner registration token."
  exit 1
fi
GH_PAT="$1"
DEPLOY_USER="${2:-deploy}"

log() { printf '\n[setup-runner] %s\n' "$*"; }

# Determine if we need to drop privileges for config
if [[ $EUID -eq 0 ]]; then
  AS_USER="runuser -u $DEPLOY_USER --"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$(dirname "$RUNNER_DIR")" 2>/dev/null || true
else
  AS_USER=""
fi

# ── 1. Download + extract runner ──────────────────────────────
if [[ ! -f "$RUNNER_DIR/bin/Runner.Listener" ]]; then
  log "1/4 Downloading GitHub Actions runner"
  mkdir -p "$RUNNER_DIR"
  if [[ $EUID -eq 0 ]]; then
    chown "$DEPLOY_USER:$DEPLOY_USER" "$RUNNER_DIR"
  fi
  cd "$RUNNER_DIR"
  curl -fsSLo runner.tar.gz \
    https://github.com/actions/runner/releases/download/v2.322.0/actions-runner-linux-x64-2.322.0.tar.gz
  tar xzf runner.tar.gz
  rm runner.tar.gz
  if [[ $EUID -eq 0 ]]; then
    chown -R "$DEPLOY_USER:$DEPLOY_USER" "$RUNNER_DIR"
  fi
else
  log "1/4 Runner binary already exists at $RUNNER_DIR"
fi

# ── 2. Get registration token ─────────────────────────────────
log "2/4 Requesting runner registration token from GitHub"
REG_TOKEN=$(curl -s -X POST \
  "https://api.github.com/repos/$REPO/actions/runners/registration-token" \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [[ -z "$REG_TOKEN" ]]; then
  echo "ERROR: Failed to get registration token. Check PAT scopes." >&2
  exit 1
fi
log "Registration token acquired (expires in ~1 hour)"

# ── 3. Configure + start ──────────────────────────────────────
log "3/4 Configuring runner (this registers it with GitHub)"
cd "$RUNNER_DIR"
$AS_USER ./config.sh --unattended \
  --url "https://github.com/$REPO" \
  --token "$REG_TOKEN" \
  --name "$(hostname)-runner" \
  --labels "self-hosted,linux,x64" \
  --work "/home/deploy/actions-runner-work"

log "4/4 Installing and starting runner as a systemd service"
./svc.sh install
./svc.sh start

sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
  log "Runner service is ACTIVE"
else
  echo "WARNING: Runner service did not start. Check: systemctl status $SERVICE_NAME" >&2
fi

log "Done. Runner '$HOSTNAME-runner' registered at:"
log "  https://github.com/$REPO/settings/actions/runners"
