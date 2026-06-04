#!/usr/bin/env bash
# Nightly backup: Postgres dump + n8n volume + ag_output volume, encrypted via
# restic and pushed to a remote repository (Backblaze B2 or Hetzner Storage Box).
#
# Restore drill (run from a workstation with the same env vars set):
#   restic snapshots
#   restic restore latest --target ./restore --include /postgres.sql
#   docker exec -i ag_postgres psql -U "$POSTGRES_USER" -d postgres < ./restore/postgres.sql
#
# Retention: 7 daily, 4 weekly, 6 monthly.
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-/srv/ag/.env}"

# Parse only the variables this script needs, without shell-sourcing.
# Sourcing the file would expand `$` inside values like the bcrypt-format
# N8N_BASIC_AUTH_PASSWORD_HASH (`$2a$14$...`) and abort under `set -u`.
if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r key val; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    val="${val#\"}"; val="${val%\"}"
    val="${val#\'}"; val="${val%\'}"
    export "$key=$val"
  done < <(grep -E '^(RESTIC_|B2_|POSTGRES_)[A-Z_]+=' "$ENV_FILE" 2>/dev/null || true)
fi

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY not set}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD not set}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_DB:?}"

STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

echo "[backup] $(date -Is) starting"

echo "[backup] dumping postgres"
docker exec ag_postgres pg_dumpall -U "$POSTGRES_USER" \
  | gzip -9 > "$STAGING/postgres-$(date +%F).sql.gz"

echo "[backup] archiving n8n volume"
docker run --rm -v ag-prod_n8n_data:/data:ro -v "$STAGING":/out alpine \
  tar -czf /out/n8n-data.tgz -C /data .

echo "[backup] archiving ag_output volume"
docker run --rm -v ag-prod_ag_output:/data:ro -v "$STAGING":/out alpine \
  tar -czf /out/ag-output.tgz -C /data .

echo "[backup] restic init (idempotent)"
restic snapshots >/dev/null 2>&1 || restic init

echo "[backup] restic backup"
restic backup --tag nightly "$STAGING"

echo "[backup] restic forget --prune (retention)"
restic forget --prune \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6

echo "[backup] $(date -Is) done"
