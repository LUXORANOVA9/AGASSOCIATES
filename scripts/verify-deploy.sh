#!/bin/bash
set -eu

echo "🚀 Starting comprehensive deployment verification..."

SERVICES=(
  "ag_ai_backend:8000/health"
  "ag_ai_dashboard:3000/"
  "ag_platform:3000/api/health"
  "ag_intake_api:3002/health"
  "ag_n8n:5678/healthz"
  "ag_postgres:5432"
  "ag_redis:6379"
  "ag_telegram_bot:8000/health"
  "ag_email_intake:8000/health"
  "ag_caddy:80/"
)

# Special handling for ports vs paths
for service in "${SERVICES[@]}"; do
  IFS=':' read -r name port_path <<< "$service"
  
  if [[ "$port_path" == *"/"* ]]; then
    path=${port_path#*/}
    port=${port_path%/*}
    echo -n "Checking $name (HTTP $port/$path)... "
    if sudo docker exec "$name" wget --spider -q "http://127.0.0.1:$port/$path" 2>/dev/null || \
       sudo docker exec "$name" curl -sf "http://127.0.0.1:$port/$path" > /dev/null; then
      echo "✅ OK"
    else
      echo "❌ FAIL"
      exit 1
    fi
  else
    echo -n "Checking $name (TCP $port_path)... "
    if sudo docker exec "$name" nc -z 127.0.0.1 "$port_path" 2>/dev/null; then
      echo "✅ OK"
    else
      echo "❌ FAIL"
      exit 1
    fi
  fi
done

echo "🎉 All services are healthy!"
