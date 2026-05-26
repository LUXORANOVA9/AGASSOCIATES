#!/usr/bin/env bash
set -euo pipefail

# AG Associates — one-command deploy + smoke test
# Usage: sudo bash scripts/auto-deploy.sh [service]
SERVICE="${1:-}"
REPO_DIR="/srv/ag/repo"
ENV_FILE="/srv/ag/.env"
COMPOSE_FILE="$REPO_DIR/docker-compose.prod.yml"

cd "$REPO_DIR"

echo "=== 1. Pull latest ==="
git pull origin main

echo "=== 2. Build images ==="
if [ -n "$SERVICE" ]; then
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build "$SERVICE"
else
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build
fi

echo "=== 3. Deploy ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

echo "=== 4. Wait for health ==="
for i in $(seq 1 12); do
    if curl -sf http://127.0.0.1:8000/health > /dev/null 2>&1; then
        echo "   API healthy after ${i}0s"
        break
    fi
    echo "   Waiting... ($((i*10))s)"
    sleep 10
done

echo "=== 5. Smoke tests ==="
# Aisha chat
echo -n "   Aisha: "
AISHA=$(curl -s -X POST http://127.0.0.1:8000/api/aisha/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"hello","user_id":"smoke_test","chat_id":"smoke"}')
echo "$AISHA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('response','')[:80])"

# Health
echo -n "   Health: "
curl -sf http://127.0.0.1:8000/health && echo " OK"

echo "=== Done ==="
