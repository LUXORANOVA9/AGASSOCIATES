#!/usr/bin/env bash
# =============================================================================
# AG Associates — Full Production Provisioning Script
# =============================================================================
# Idempotent one-shot. Run from any machine with curl, python3, ssh-keygen, ssh.
#
# Usage:
#   export HETZNER_API_TOKEN="..."
#   export CLOUDFLARE_API_TOKEN="..."
#   export GROQ_API_KEY="gsk_..."
#   export SUPABASE_URL="https://xxx.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
#   export SUPABASE_ANON_KEY="eyJ..."
#   export GH_PAT="ghp_..."
#   bash scripts/provision.sh
#
# Or pass as args:
#   bash scripts/provision.sh \
#     --hetzner-token "..." --cf-token "..." --groq-key "gsk_..." \
#     --supabase-url "https://..." --supabase-service-role-key "eyJ..." \
#     --supabase-anon-key "eyJ..." --gh-pat "ghp_..."
# =============================================================================
set -euo pipefail

# ── Parse args ─────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hetzner-token)      HETZNER_API_TOKEN="$2";       shift 2 ;;
    --cf-token)           CLOUDFLARE_API_TOKEN="$2";     shift 2 ;;
    --groq-key)           GROQ_API_KEY="$2";             shift 2 ;;
    --supabase-url)       SUPABASE_URL="$2";             shift 2 ;;
    --supabase-service-role-key) SUPABASE_SERVICE_ROLE_KEY="$2"; shift 2 ;;
    --supabase-anon-key)  SUPABASE_ANON_KEY="$2";        shift 2 ;;
    --gh-pat)             GH_PAT="$2";                   shift 2 ;;
    --domain)             DOMAIN="$2";                    shift 2 ;;
    --server-type)        SERVER_TYPE="$2";               shift 2 ;;
    --location)           LOCATION="$2";                  shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

: "${HETZNER_API_TOKEN:?Must set HETZNER_API_TOKEN}"
: "${CLOUDFLARE_API_TOKEN:?Must set CLOUDFLARE_API_TOKEN}"
: "${GROQ_API_KEY:?Must set GROQ_API_KEY}"
: "${SUPABASE_URL:?Must set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Must set SUPABASE_SERVICE_ROLE_KEY}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-${SUPABASE_PUBLISHABLE_KEY:-}}"
: "${SUPABASE_ANON_KEY:?Must set SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY}"
: "${GH_PAT:?Must set GH_PAT}"
DOMAIN="${DOMAIN:-advadiityagade.com}"
SERVER_TYPE="${SERVER_TYPE:-ccx23}"
LOCATION="${LOCATION:-nbg1}"
ZONE_ID="${ZONE_ID:-ad78f4619af17346172199dc76082cab}"

# ── Helpers ────────────────────────────────────────────────────────────────
log()  { printf '\n[provision] %s\n' "$*"; }
die()  { echo "FATAL: $*" >&2; exit 1; }
cleanup() { rm -f /tmp/vps-bootstrap-key /tmp/vps-bootstrap-key.pub; }
trap cleanup EXIT

HETZNER_API="https://api.hetzner.cloud/v1"
CF_API="https://api.cloudflare.com/client/v4"
REPO="LUXORANOVA9/AGASSOCIATES"

# ── 0. Prepare bootstrap scripts ──────────────────────────────────────────
log "0/9 Preparing bootstrap scripts"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$SCRIPT_DIR/bootstrap-vps.sh" && -f "$SCRIPT_DIR/setup-runner.sh" ]]; then
  log "Using local scripts from $SCRIPT_DIR"
  BOOTSTRAP_SCRIPTS="$SCRIPT_DIR"
else
  log "Downloading bootstrap scripts from GitHub"
  mkdir -p /tmp/ag-provision
  curl -sfL "https://raw.githubusercontent.com/$REPO/main/scripts/bootstrap-vps.sh" > /tmp/ag-provision/bootstrap-vps.sh
  curl -sfL "https://raw.githubusercontent.com/$REPO/main/scripts/setup-runner.sh" > /tmp/ag-provision/setup-runner.sh
  chmod +x /tmp/ag-provision/*.sh
  BOOTSTRAP_SCRIPTS="/tmp/ag-provision"
fi

# ── 1. Generate SSH key ────────────────────────────────────────────────────
log "1/9 Generating bootstrap SSH key"
ssh-keygen -t ed25519 -f /tmp/vps-bootstrap-key -N "" -q
PUBKEY=$(cat /tmp/vps-bootstrap-key.pub)

# ── 2. Upload SSH key to Hetzner ──────────────────────────────────────────
log "2/9 Uploading SSH key to Hetzner"
SSH_KEY_ID=$(curl -sf -X POST "$HETZNER_API/ssh_keys" \
  -H "Authorization: Bearer $HETZNER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"ag-provision-$(date +%s)\",\"public_key\":\"$PUBKEY\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['ssh_key']['id'])") \
  || die "Failed to upload SSH key"

# ── 3. Create server ──────────────────────────────────────────────────────
log "3/9 Creating Hetzner $SERVER_TYPE server in $LOCATION"
CLOUD_INIT=$(cat <<'CLOUDEOF'
#cloud-config
package_update: true
packages:
  - ca-certificates curl gnupg lsb-release git
runcmd:
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  - chmod a+r /etc/apt/keyrings/docker.gpg
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  - apt-get update -y
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  - systemctl enable --now docker
  - adduser --disabled-password --gecos "" deploy
  - usermod -aG docker deploy
CLOUDEOF
)

SERVER_RESP=$(curl -sf -X POST "$HETZNER_API/servers" \
  -H "Authorization: Bearer $HETZNER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ag-prod\",
    \"server_type\": \"$SERVER_TYPE\",
    \"image\": \"ubuntu-24.04\",
    \"location\": \"$LOCATION\",
    \"ssh_keys\": [$SSH_KEY_ID],
    \"user_data\": \"$(echo "$CLOUD_INIT" | base64 -w0)\"
  }") || die "Failed to create server"

VPS_IP=$(echo "$SERVER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])")
log "Server IP: $VPS_IP"

log "Waiting for SSH…"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i /tmp/vps-bootstrap-key \
    root@"$VPS_IP" "echo READY" 2>/dev/null && break
  sleep 5
done

# ── 4. DNS ─────────────────────────────────────────────────────────────────
log "4/9 Configuring DNS"
for sub in app dashboard api n8n docs intake; do
  NAME="${sub}.${DOMAIN}"
  EXISTING=$(curl -sf "$CF_API/zones/$ZONE_ID/dns_records?name=$NAME&type=A" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
  REC_ID=$(echo "$EXISTING" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id']) if d.get('result') else print('')")
  if [ -n "$REC_ID" ]; then
    curl -sf -X PATCH "$CF_API/zones/$ZONE_ID/dns_records/$REC_ID" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"A\",\"name\":\"$NAME\",\"content\":\"$VPS_IP\",\"ttl\":120,\"proxied\":false}" >/dev/null
  else
    curl -sf -X POST "$CF_API/zones/$ZONE_ID/dns_records" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"A\",\"name\":\"$NAME\",\"content\":\"$VPS_IP\",\"ttl\":120,\"proxied\":false}" >/dev/null
  fi
  log "  $NAME → $VPS_IP"
done

# ── 5. Bootstrap VPS ──────────────────────────────────────────────────────
log "5/9 Bootstrapping VPS"
scp -q -o StrictHostKeyChecking=no -i /tmp/vps-bootstrap-key \
  "$BOOTSTRAP_SCRIPTS"/{bootstrap-vps.sh,setup-runner.sh} root@"$VPS_IP":/root/

ssh -o StrictHostKeyChecking=no -i /tmp/vps-bootstrap-key root@"$VPS_IP" \
  "GH_PAT=$GH_PAT bash /root/bootstrap-vps.sh" </dev/null

ssh -o StrictHostKeyChecking=no -i /tmp/vps-bootstrap-key root@"$VPS_IP" \
  "echo '$PUBKEY' >> /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys && chown -R deploy:deploy /home/deploy/.ssh"

# ── 6. Write .env ─────────────────────────────────────────────────────────
log "6/9 Writing /srv/ag/.env"
PW1=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
PW2=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT=$(openssl rand -hex 64)
SJWT=$(openssl rand -hex 64)
NWK=$(openssl rand -hex 32)
NAU="admin"
NAH=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 16)

ssh -o StrictHostKeyChecking=no -i /tmp/vps-bootstrap-key root@"$VPS_IP" "cat > /srv/ag/.env << ENVEOF
DOMAIN=$DOMAIN
ACME_EMAIL=admin@$DOMAIN
POSTGRES_USER=agadmin
POSTGRES_PASSWORD=$PW1
POSTGRES_DB=agdb
REDIS_PASSWORD=$PW2
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL_NAME=llama-3.3-70b-versatile
LLM_API_KEY=$GROQ_API_KEY
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_JWT_SECRET=$SJWT
JWT_SECRET=$JWT
N8N_WEBHOOK_KEY=$NWK
N8N_BASIC_AUTH_USER=$NAU
N8N_BASIC_AUTH_PASSWORD_HASH=$NAH
TELEGRAM_BOT_TOKEN=placeholder_replace_when_ready
EMAIL_IMAP_HOST=placeholder_replace_when_ready
EMAIL_IMAP_PORT=993
EMAIL_IMAP_USER=placeholder_replace_when_ready
EMAIL_IMAP_PASS=placeholder_replace_when_ready
EMAIL_POLL_INTERVAL=60
GOOGLE_GENERATIVE_AI_API_KEY=
RESEND_API_KEY=
ENVIRONMENT=production
LLM_MOCK_MODE=false
IMAGE_TAG=latest
ENVEOF
chmod 600 /srv/ag/.env
chown deploy:deploy /srv/ag/.env"

# ── 7. Verify runner ──────────────────────────────────────────────────────
log "7/9 Verifying self-hosted runner"
sleep 5
RUNNER_STATUS=$(curl -sf -H "Authorization: Bearer $GH_PAT" \
  "https://api.github.com/repos/$REPO/actions/runners" \
  | python3 -c "import sys,json; rs=json.load(sys.stdin)['runners']; print(rs[0]['status']+'/'+str(rs[0]['busy']).lower())" 2>/dev/null || echo "unknown")
log "Runner: $RUNNER_STATUS"

# ── 8. Store GH_PAT secret ────────────────────────────────────────────────
log "8/9 Storing GH_PAT as repo secret"
curl -sf -X PUT "https://api.github.com/repos/$REPO/actions/secrets/GH_PAT" \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{\"encrypted_value\":\"$(curl -sf https://api.github.com/repos/$REPO/actions/secrets/public-key -H "Authorization: Bearer $GH_PAT" | python3 -c "
import sys,json,base64
d=json.load(sys.stdin)
pub=base64.b64decode(d['key'])
import nacl.bindings as N
enc=N.crypto_box_seal(b'$GH_PAT',pub)
print(base64.b64encode(enc).decode())
\" 2>/dev/null)\",\"key_id\":\"$(curl -sf https://api.github.com/repos/$REPO/actions/secrets/public-key -H \"Authorization: Bearer $GH_PAT\" | python3 -c \"import sys,json; print(json.load(sys.stdin)['key_id'])\" 2>/dev/null)\"}" >/dev/null 2>&1 || echo "WARNING: Could not store GH_PAT (install python3-nacl)"

# ── 9. Trigger deploy ─────────────────────────────────────────────────────
log "9/9 Triggering first deploy"
curl -sf -X POST "https://api.github.com/repos/$REPO/actions/workflows/deploy.yml/dispatches" \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{\"ref\":\"main\"}" >/dev/null && log "Deploy triggered"

# ── Done ──────────────────────────────────────────────────────────────────
log "══════════════════════════════════════════════════════════════"
log "Provisioning complete!"
log ""
log "  VPS IP:      $VPS_IP"
log "  Domain:      $DOMAIN"
log "  Dashboard:   https://app.$DOMAIN"
log "  API:         https://api.$DOMAIN/health"
log "  n8n:         https://n8n.$DOMAIN"
log "  Runner:      https://github.com/$REPO/settings/actions/runners"
log ""
log "  SSH:         ssh -i /tmp/vps-bootstrap-key deploy@$VPS_IP"
log "  .env:        /srv/ag/.env"
log ""
log "  Postgres:    $PW1"
log "  Redis:       $PW2"
log "  JWT secret:  ${JWT:0:16}..."
log "══════════════════════════════════════════════════════════════"
