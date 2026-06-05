# SMS Forwarder — Setup (2 minutes)

You need **one Android phone with a SIM**. That phone receives bank OTPs. This app forwards them to our Telegram ops room in under 3 seconds.

## Step 1 — Install

Download **pppscn/SmsForwarder** from:
- [GitHub Releases](https://github.com/pppscn/SmsForwarder/releases) (APK in Assets)
- Or the app is on F-Droid / elsewhere

Grant **SMS + Notifications** permission when asked.

## Step 2 — Add ONE forwarder

Open the app. Bottom tab bar:

1. Tap **发送通道** (Send Channel) / or the gear icon tab
2. Tap **Webhook** from the list
3. Fill in:

| Field | Value |
|-------|-------|
| **Method** | **GET** (dropdown at top) |
| **URL** / **WebServer** | `https://intake.agassociates.in/api/v1/webhook/sms-incoming` |
| **webParams** | (leave empty) |

Tap ✔ **Save** (top-right).

4. Go to **转发规则** (Forwarding Rules) tab → tap **+** → select **SMS** → tick this Webhook channel → Save → enable the toggle.

That's it. **No body template. No Content-Type. No org_id.** The app auto-appends `from`, `content`, `timestamp` as query params.

## Step 3 — Test

Have someone SMS you. You'll see a `200 OK` notification. Done.

## What happens next

- OTP appears in the Telegram group ops room within 3 seconds
- Any on-duty staff taps **[💰 Claim]** → OTP is DM'd privately
- Staff member pastes it into the portal
- **You don't do anything else**

## Registration

Tell us your phone number once. We register it on the backend so your SMS is attributed to the right firm. After that, the URL above works forever.
