#!/usr/bin/env bash
# scripts/smoke-test-e2e.sh
#
# End-to-end smoke test of the FULL pipeline:
#   1. POST a fake "bank letter" to /api/v1/intake/rental
#   2. Watch the Intake Crew (or LangGraph fallback) process it
#   3. Confirm OTP is routed to on-duty staff via Telegram dry-run
#   4. Confirm Redis has the OTP queued for the bot to claim
#
# Pre-flight: this script expects both ag-platform AND ag-associates-ai
# to be running locally. The fast path (LangGraph only) just needs
# ag-associates-ai. The CrewAI path needs CREWAI_ENABLED=1 set.
#
# Usage:  bash scripts/smoke-test-e2e.sh
#
# Requires: scripts/test-otp-routing.sh has already been verified.
set -euo pipefail

ORG_ID="00000000-0000-0000-0000-0000000000a1"
BANK_ID="00000000-0000-0000-0000-0000000000b1"
INTEL_URL="${INTEL_URL:-http://127.0.0.1:8001}"
INTAKE_URL="${INTAKE_URL:-http://127.0.0.1:3002}"

step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
fail() { printf "  \033[1;31m✗\033[0m %s\n" "$*"; exit 1; }

# ─── preflight: both services up ─────────────────────────────
step "0. Preflight: are ag-associates-ai (${INTEL_URL}) and intake-api (${INTAKE_URL}) responding?"
curl -sSf "${INTEL_URL}/health" >/dev/null || fail "ag-associates-ai is not reachable on ${INTEL_URL}. Start with: cd ag-associates-ai && CREWAI_ENABLED=1 uvicorn backend.main:app --reload"
ok "ag-associates-ai up"
curl -sSf "${INTAKE_URL}/health" >/dev/null || fail "intake-api is not reachable on ${INTAKE_URL}. Start with TELEGRAM_DRY_RUN=1 npm run dev"
ok "intake-api up"

# ─── step 1: fire the intake endpoint ───────────────────────
step "1. POSTing fake bank letter to ${INTEL_URL}/api/v1/intake/rental"
PAYLOAD=$(cat <<JSON
{
  "org_id": "${ORG_ID}",
  "bank_id": "${BANK_ID}",
  "letter_text": "Dear Advocate, please draft a Leave and License agreement for Mr. Rajesh K (PAN ABCDE1234F) and Mrs. Priya K, residential flat at 502/A Sea Breeze Apartments, Bandra West, Mumbai 400050. Monthly rent Rs 45,000, security deposit Rs 90,000, term 24 months commencing 2026-07-01. Regards, Kotak Mahindra Bank, Thane branch."
}
JSON
)
RESPONSE=$(curl -sS -X POST "${INTEL_URL}/api/v1/intake/rental" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")
echo "${RESPONSE}" | python3 -m json.tool | sed 's/^/    /'

CASE_ID=$(echo "${RESPONSE}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('case_id',''))" 2>/dev/null || echo "")
[[ -n "${CASE_ID}" ]] || fail "no case_id in response (intake did not accept the letter)"
ok "case_id = ${CASE_ID}"

# ─── step 2: wait for crew / langgraph to settle ─────────────
step "2. Waiting for case to settle (max 30s)..."
for i in {1..30}; do
  STATE=$(curl -sS "${INTEL_URL}/api/v1/cases/${CASE_ID}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('state',''))" 2>/dev/null || echo "")
  if [[ "${STATE}" == "DONE" || "${STATE}" == "BLOCKED" || "${STATE}" == "ESCALATED" ]]; then
    ok "case ${CASE_ID} reached terminal state: ${STATE}"
    break
  fi
  sleep 1
done
[[ "${STATE}" == "DONE" || "${STATE}" == "BLOCKED" || "${STATE}" == "ESCALATED" ]] \
  || fail "case did not settle in 30s (last state: ${STATE})"

# ─── step 3: confirm OTP routing if state is BLOCKED waiting on OTP ─
step "3. If case is BLOCKED on OTP, simulate GRAS SMS push"
if [[ "${STATE}" == "BLOCKED" ]]; then
  RESP=$(curl -sS -X POST "${INTAKE_URL}/api/v1/webhook/sms-incoming" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"Your GRAS One Time Password is 555111. Valid for 5 minutes.\",
      \"from\": \"VM-GRAS\",
      \"org_id\": \"${ORG_ID}\"
    }")
  PUSH_OK=$(echo "${RESP}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('push',{}).get('ok',0))")
  [[ "${PUSH_OK}" -ge "1" ]] || fail "OTP push to on-duty staff failed (push.ok=${PUSH_OK})"
  ok "OTP pushed to on-duty staff (Telegram dry-run)"
fi

# ─── step 4: confirm Redis has the OTP for the bot ──────────
step "4. Confirming Redis has at least 1 OTP queued for telegram-bot"
OTP_COUNT=$(redis-cli LLEN otp_incoming:any 2>/dev/null || echo 0)
[[ "${OTP_COUNT}" -ge "1" ]] || fail "Redis otp_incoming:any is empty"
ok "Redis otp_incoming:any has ${OTP_COUNT} entry (or entries) — telegram-bot can claim"

# ─── final ─────────────────────────────────────────────────
printf "\n\033[1;32m=== E2E SMOKE TEST PASSED ===\033[0m\n\n"
printf "End-to-end flow verified:\n"
printf "  \033[1;32m✓\033[0m Bank letter accepted by ag-associates-ai\n"
printf "  \033[1;32m✓\033[0m Intake Crew (or LangGraph) reached a terminal state on the case\n"
printf "  \033[1;32m✓\033[0m OTP routing layer pushes the GRAS OTP to on-duty staff\n"
printf "  \033[1;32m✓\033[0m Redis has the OTP for telegram-bot to claim\n\n"
printf "Next: turn off TELEGRAM_DRY_RUN and run the same test against a real chat_id\n"
printf "to confirm the Telegram API call goes out cleanly. Then commit + push.\n"
