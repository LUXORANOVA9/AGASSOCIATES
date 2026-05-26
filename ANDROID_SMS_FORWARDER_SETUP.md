# Android SMS Forwarder Setup — IDBI / ICICI Bank OTP → Telegram

## Overview

Forward OTP SMS from IDBI Bank, ICICI Bank, and other portals directly to your Telegram. The flow:

```
Phone SMS → Android Forwarder App → api.advadiityagade.com/api/sms/ingest → Redis → Telegram Bot → Your Chat
```

## Step 1: Install an SMS Forwarder App

Install **"SMS Forwarder"** by Kelp Apps from the Play Store:
https://play.google.com/store/apps/details?id=com.kelp.smsforwarder

Other options: "SMS Forwarder - Auto Forwarding" or any app that can POST SMS to a URL.

## Step 2: Configure Forwarding Rule

Open the app and create a rule:

| Field | Value |
|-------|-------|
| **Sender filter** | `IDBI` (or leave blank to forward all) |
| **Message filter** | `OTP` (or leave blank to forward all) |
| **Action** | HTTP Request (POST) |
| **URL** | `https://api.advadiityagade.com/api/sms/ingest` |
| **Content-Type** | `application/json` |
| **JSON Body** | `{"from": "%SENDER%", "text": "%TEXT%", "received_at": "%DATE%"}` |

### Alternative: Forward ALL Bank SMS

If your forwarder app supports multiple rules, add one per bank:

| Bank | Sender Filter |
|------|--------------|
| IDBI | `IDBI` |
| ICICI | `ICICI` |
| HDFC | `HDFC` |
| Axis | `Axis` |

## Step 3: Enable Auto-Forward in Telegram

1. Open Telegram and find `@ag_associates_bot`
2. Send `/start` (if not already registered)
3. Send `/autootp`

You'll see:

> ✅ **Auto-OTP forwarding enabled!** 🔄
> All incoming OTP codes from **IDBI Bank**, **ICICI Bank**, and other portals will be forwarded to this chat automatically.

## Step 4: Verify

Send a test SMS from your phone to your own number containing "Test OTP 123456 from IDBI". It should appear in your Telegram within seconds.

## How It Works

1. **Android App** intercepts incoming SMS matching your filter rules
2. **HTTP POST** sends the SMS text to our FastAPI endpoint
3. **Redis** queues the SMS for the Telegram bot
4. **Telegram Bot** picks it up via Redis BLPOP, extracts the OTP code, detects the bank/portal, and delivers to all staff with `/autootp` enabled
5. **You** receive the OTP instantly in Telegram

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| OTP not arriving in Telegram | Check Android app logs — is it sending? Check `api.advadiityagade.com` is reachable |
| "No OTP found" in logs | The SMS text may not contain 4-8 digit code. Check `sms:orphans` in Redis |
| `/autootp` not responding | Bot may be restarting. Wait 10s and retry |
| Multiple copies received | Multiple staff have `/autootp` enabled — disable for others if not needed |
