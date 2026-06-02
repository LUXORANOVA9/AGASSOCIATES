#!/bin/bash
# Simple health monitor — checks all services, logs failures

SERVICES=(
  "https://api.advadiityagade.com/health"
  "https://api.advadiityagade.com/api/aisha/chat"
)

for url in "${SERVICES[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$status" != "200" ] && [ "$status" != "405" ]; then
    echo "[$(date)] FAIL $url — HTTP $status" >> /var/log/ag-health.log
  fi
done

# Check Docker containers
docker ps --format '{{.Names}} {{.Status}}' | grep -v "Up " >> /var/log/ag-health.log 2>&1
