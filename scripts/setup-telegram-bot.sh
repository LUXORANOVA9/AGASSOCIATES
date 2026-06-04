#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════════════"
echo "  Telegram OTP Bot Setup"
echo "═══════════════════════════════════════════"
echo ""
echo "You need to create a Telegram bot via @BotFather."
echo ""
echo "Steps:"
echo "  1. Open Telegram and search for @BotFather"
echo "  2. Send /newbot"
echo "  3. Choose a name (e.g., 'AG Associates OTP Bot')"
echo "  4. Choose a username (e.g., 'ag_otp_bot' — must end in 'bot')"
echo "  5. @BotFather will give you an HTTP API token"
echo "  6. Copy the token (looks like: 1234567890:ABCdefGHIjklmNOPqrSTUvwxYZ)"
echo ""

read -rp "Paste your bot token: " BOT_TOKEN

# Verify the token works
echo ""
echo "Verifying token..."
RESP=$(curl -sf "https://api.telegram.org/bot${BOT_TOKEN}/getMe" 2>/dev/null || echo "")
if [ -z "$RESP" ]; then
  echo "❌ Invalid token or Telegram API unreachable"
  exit 1
fi

BOT_NAME=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['username'])" 2>/dev/null)
echo "✅ Token verified! Bot: @${BOT_NAME}"
echo ""

# Get admin chat IDs
echo "Now you need to know your Telegram chat ID."
echo "Send a message to @${BOT_NAME} on Telegram, then check the URL below."
echo ""
echo "Run this in another terminal to find your chat ID:"
echo "  curl -sf \"https://api.telegram.org/bot${BOT_TOKEN}/getUpdates\" | python3 -m json.tool"
echo ""
read -rp "Enter your chat ID (or press Enter to skip): " ADMIN_ID

# Output env vars
echo ""
echo "═══════════════════════════════════════════"
echo "  Add these to your /srv/ag/.env file:"
echo "═══════════════════════════════════════════"
echo "TELEGRAM_BOT_TOKEN=${BOT_TOKEN}"
if [ -n "$ADMIN_ID" ]; then
  echo "ADMIN_CHAT_IDS=${ADMIN_ID}"
fi
echo ""
echo "═══════════════════════════════════════════"
