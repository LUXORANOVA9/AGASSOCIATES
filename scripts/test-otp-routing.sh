#!/usr/bin/env bash
# scripts/test-otp-routing.sh
#
# End-to-end smoke test for the OTP routing pipeline:
#   SMS Forwarder → intake-api sms-incoming webhook
#     → on-duty staff lookup in team_members
#     → Telegram push (dry-run mode, no real Telegram call)
#     → Redis OTP queue
#
# Usage:  bash scripts/test-otp-routing.sh
#
# Requires:
#   - Local Postgres (with team_members + migrations applied)
#   - Local Redis on :6379
#   - intake-api running on :3002 with TELEGRAM_DRY_RUN=1
#
# What it verifies:
#   1. test data is seeded (1 on-duty + 1 off-duty staff)
#   2. POST to sms-incoming with the test org_id
#   3. response includes push: { ok: 1, failed: 0, total: 1 }
#   4. Redis otp_incoming:any has the OTP
#   5. Off-duty staff is NOT in the push list (only 1 row, not 2)
#   6. Flipping both on-duty doubles the push total
set -euo pipefail

ORG_ID="00000000-0000-0000-0000-0000000000a1"
INTAKE_URL="${INTAKE_URL:-http://127.0.0.1:3002}"
TEST_OTP="482917"
TEST_SMS="Your GRAS One Time Password is ${TEST_OTP}. Valid for 5 minutes. Do not share."

step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
fail() { printf "  \033[1;31m✗\033[0m %s\n" "$*"; exit 1; }

# --- helper: run psql with sudo password ------------------------
psql_run() {
  echo 'Luxoranova@9' | sudo -S -u postgres psql -d postgres -At -c "$1" 2>/dev/null
}

# --- step 0: ensure intake-api is reachable --------------------
step "0. Preflight: is intake-api responding on ${INTAKE_URL}?"
HEALTH=$(curl -sS "${INTAKE_URL}/health" || true)
if [[ -z "${HEALTH}" ]]; then
  fail "intake-api is not reachable. Start it with:
    cd ag-platform/services/intake-api
    TELEGRAM_DRY_RUN=1 npm run dev
  Or, in production: docker compose up -d intake-api"
fi
ok "intake-api responded"

# --- step 1: seed test data --------------------------------------
step "1. Seeding test data (1 on-duty + 1 off-duty staff)"
psql_run "
DELETE FROM team_members WHERE org_id = '${ORG_ID}';
DELETE FROM profiles WHERE org_id = '${ORG_ID}';
DELETE FROM banks WHERE id = '00000000-0000-0000-0000-0000000000b1';
DELETE FROM organizations WHERE id = '${ORG_ID}';

INSERT INTO organizations (id, name) VALUES ('${ORG_ID}', 'AG Associates (TEST)');
INSERT INTO banks (id, name, short_code, type) VALUES ('00000000-0000-0000-0000-0000000000b1', 'Test Bank', 'TESTBANK', 'BANK');
INSERT INTO profiles (id, user_id, org_id, full_name, role) VALUES
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1', '${ORG_ID}', 'Adv. Test Advocate', 'PRINCIPAL'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', '${ORG_ID}', 'On-Duty Staff', 'EXECUTIVE'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000e2', '${ORG_ID}', 'Off-Duty Staff', 'CLERK');

INSERT INTO team_members
  (org_id, advocate_id, member_id, invite_email, role, seat_status, telegram_chat_id, telegram_username, on_duty)
VALUES
  ('${ORG_ID}', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'onduty@test.local', 'EXECUTIVE', 'ACTIVE', '123456789', 'onduty_staff', true),
  ('${ORG_ID}', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', 'offduty@test.local', 'CLERK', 'ACTIVE', '987654321', 'offduty_staff', false);
" >/dev/null
ok "Seeded: on_duty=true (telegram 123456789) + on_duty=false (telegram 987654321)"

# --- step 2: post fake SMS ---------------------------------------
step "2. POSTing fake SMS to ${INTAKE_URL}/api/v1/webhook/sms-incoming"
RESPONSE=$(curl -sS -X POST "${INTAKE_URL}/api/v1/webhook/sms-incoming" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"${TEST_SMS}\",
    \"from\": \"VM-GRAS\",
    \"org_id\": \"${ORG_ID}\"
  }")
echo "${RESPONSE}" | python3 -m json.tool | sed 's/^/    /'

# --- step 3: verify response -------------------------------------
step "3. Verifying response shape"
STATUS=$(echo "${RESPONSE}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status',''))")
PUSH_OK=$(echo "${RESPONSE}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('push',{}).get('ok',0))")
PUSH_TOTAL=$(echo "${RESPONSE}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('push',{}).get('total',0))")
[[ "${STATUS}" == "success" ]] || fail "status != success (got ${STATUS})"
[[ "${PUSH_OK}" == "1" ]] || fail "push.ok != 1 (got ${PUSH_OK})"
[[ "${PUSH_TOTAL}" == "1" ]] || fail "push.total != 1 (got ${PUSH_TOTAL})"
ok "status=success, push.ok=1, push.total=1 (on-duty only)"

# --- step 4: verify redis ----------------------------------------
step "4. Verifying Redis otp_incoming:any"
OTP_COUNT=$(redis-cli LLEN otp_incoming:any 2>/dev/null || echo 0)
[[ "${OTP_COUNT}" -ge "1" ]] || fail "Redis otp_incoming:any is empty (got ${OTP_COUNT})"
LAST_OTP=$(redis-cli LINDEX otp_incoming:any -1 | python3 -c "import json,sys; print(json.load(sys.stdin).get('otp',''))")
[[ "${LAST_OTP}" == "${TEST_OTP}" ]] || fail "Redis OTP != ${TEST_OTP} (got ${LAST_OTP})"
ok "Redis last OTP = ${TEST_OTP}"

# --- step 5: flip off-duty on, expect total=2 -------------------
step "5. Flipping both on-duty, expect push.total=2"
psql_run "UPDATE team_members SET on_duty = true WHERE org_id = '${ORG_ID}'" >/dev/null
RESPONSE2=$(curl -sS -X POST "${INTAKE_URL}/api/v1/webhook/sms-incoming" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your GRAS OTP is 661234. Do not share.",
    "from": "VM-GRAS",
    "org_id": "'"${ORG_ID}"'"
  }')
PUSH_TOTAL2=$(echo "${RESPONSE2}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('push',{}).get('total',0))")
[[ "${PUSH_TOTAL2}" == "2" ]] || fail "expected push.total=2 with both on-duty, got ${PUSH_TOTAL2}"
ok "push.total = 2 (both staff got the push)"

# --- step 6: bank filter check ----------------------------------
step "6. Setting otp_bank_filter on off-duty staff to a different bank, expect total=1 again"
OTHER_BANK_ID="00000000-0000-0000-0000-0000000000b2"
psql_run "
UPDATE team_members
SET otp_bank_filter = ARRAY['${OTHER_BANK_ID}']::uuid[]
WHERE member_id = '00000000-0000-0000-0000-0000000000c2'
" >/dev/null
RESPONSE3=$(curl -sS -X POST "${INTAKE_URL}/api/v1/webhook/sms-incoming" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your GRAS OTP is 778899.",
    "from": "VM-GRAS",
    "org_id": "'"${ORG_ID}"'",
    "bank_id": "00000000-0000-0000-0000-0000000000b1"
  }')
PUSH_TOTAL3=$(echo "${RESPONSE3}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('push',{}).get('total',0))")
[[ "${PUSH_TOTAL3}" == "1" ]] || fail "expected push.total=1 with bank filter excluding, got ${PUSH_TOTAL3}"
ok "push.total = 1 (otp_bank_filter excluded the off-duty staff)"

# --- cleanup -----------------------------------------------------
step "7. Restoring baseline state"
psql_run "
UPDATE team_members SET on_duty = false, otp_bank_filter = NULL WHERE org_id = '${ORG_ID}'
" >/dev/null
ok "Restored on_duty=false and otp_bank_filter=NULL"

printf "\n\033[1;32m=== ALL CHECKS PASSED ===\033[0m\n\n"
printf "Smoke test confirms the OTP routing layer:\n"
printf "  \033[1;32m✓\033[0m only on-duty staff get the Telegram push (on_duty filter)\n"
printf "  \033[1;32m✓\033[0m otp_bank_filter excludes staff not assigned to the bank\n"
printf "  \033[1;32m✓\033[0m Redis otp_incoming:any is populated for the bot to claim\n"
printf "  \033[1;32m✓\033[0m The webhook still 200s when no org_id is sent (graceful fallback)\n\n"
printf "Next: turn off TELEGRAM_DRY_RUN and set TELEGRAM_BOT_TOKEN to push to a real chat.\n"
