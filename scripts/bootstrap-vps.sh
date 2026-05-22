#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 24.04 VPS for AG Associates production.
# Idempotent — safe to re-run. Run as root or via sudo.
#
# Usage:  curl -fsSL https://raw.githubusercontent.com/LUXORANOVA9/AGASSOCIATES/main/scripts/bootstrap-vps.sh | sudo bash
# or:     sudo bash scripts/bootstrap-vps.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/LUXORANOVA9/AGASSOCIATES.git}"
SRV_DIR="/srv/ag"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

log() { printf '\n[bootstrap] %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Run as root."; exit 1; }

log "1/8 Updating apt index and applying security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get -y upgrade
apt-get install -y \
  ca-certificates curl gnupg lsb-release \
  ufw fail2ban unattended-upgrades \
  git rsync restic age cron

log "2/8 Configuring UFW firewall (22, 80, 443)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "3/8 Enabling unattended-upgrades and fail2ban"
dpkg-reconfigure -f noninteractive unattended-upgrades || true
systemctl enable --now fail2ban

log "4/8 Installing Docker Engine + Compose plugin"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io \
                     docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

log "5/8 Creating deploy user '$DEPLOY_USER'"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
mkdir -p "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 700 "/home/$DEPLOY_USER/.ssh"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
echo ">>> Paste the GitHub Actions deploy public key into /home/$DEPLOY_USER/.ssh/authorized_keys"

log "6/8 Creating /srv/ag tree and cloning repo"
mkdir -p "$SRV_DIR"/{backups,clerk-docs/dist}
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$SRV_DIR"
if [[ ! -d "$SRV_DIR/repo/.git" ]]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$SRV_DIR/repo"
fi
if [[ ! -f "$SRV_DIR/.env" ]]; then
  cp "$SRV_DIR/repo/.env.example" "$SRV_DIR/.env"
  chmod 600 "$SRV_DIR/.env"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$SRV_DIR/.env"
  echo ">>> Edit $SRV_DIR/.env and fill in every value before continuing."
fi

log "7/8 Pre-pulling base images to warm the layer cache"
sudo -u "$DEPLOY_USER" docker pull caddy:2-alpine || true
sudo -u "$DEPLOY_USER" docker pull pgvector/pgvector:pg16 || true
sudo -u "$DEPLOY_USER" docker pull n8nio/n8n:latest || true

log "8/8 Installing nightly backup cron"
install -m 0755 "$SRV_DIR/repo/scripts/backup.sh" /usr/local/sbin/ag-backup
cat >/etc/cron.d/ag-backup <<EOF
# AG Associates nightly backup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 2 * * *  $DEPLOY_USER  /usr/local/sbin/ag-backup >> /var/log/ag-backup.log 2>&1
EOF

log "Done. Next steps:"
cat <<EOF

  1. Paste your CI deploy SSH public key into /home/$DEPLOY_USER/.ssh/authorized_keys
  2. Edit $SRV_DIR/.env  (mode 0600) and replace every REPLACE_WITH_* value
   3. Point DNS A records to this VPS for:
        app.<domain>  dashboard.<domain>  api.<domain>  n8n.<domain>  docs.<domain>  intake.<domain>
  4. As $DEPLOY_USER:
       cd $SRV_DIR/repo && docker compose --env-file $SRV_DIR/.env up -d --build
  5. After the stack is healthy, confirm:
       curl -sf https://api.<domain>/health

EOF
