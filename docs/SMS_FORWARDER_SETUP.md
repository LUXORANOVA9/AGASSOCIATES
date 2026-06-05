# SMS Forwarder — Bank to AG Associates Setup

> One-page guide for the bank staff member / customer who is the
> endpoint of the OTP-routing pipeline. **Install once on your
> personal Android phone, then forget it.**

---

## Why this exists

When IGR-Maharashtra or any other government registration system
sends a 6-digit OTP to your phone (GRAS, e-Registrar, etc.), we
need to capture that OTP within 30 seconds so the AI agent can
file the NOI on your behalf. The legal Tech requirement is that
**no human in the office should ever have to type an OTP into a
form again** — it goes from your phone, to our backend, to the
on-duty staff's Telegram, in under 5 seconds.

## What you need

- A personal Android phone (v8.0+ / Oreo and above)
- The bank's SMS gateway is **NOT** changed in any way
- A 1-time install of the **SMS Forwarder** app
  ([Play Store link](https://play.google.com/store/apps/details?id=com.frzinapps.smsforward))
- Our `org_id` value (printed below for you, no need to type)

## Install (3 minutes)

1. Install **SMS Forwarder** by FrzinApps from the Play Store.
2. Open the app. On first run it will ask for **SMS** and
   **Notification** permissions — grant both. (The notification
   permission lets the app read bank-app OTPs that arrive as
   push notifications, not just plain SMS.)
3. Tap **+ Add Forwarding** → **HTTP / Web URL**.
4. Fill in the fields exactly as below:

   | Field          | Value                                              |
   |----------------|----------------------------------------------------|
   | **Method**     | POST                                               |
   | **URL**        | `https://intake.agassociates.in/api/v1/webhook/sms-incoming` |
   | **Content-Type** | `application/json`                              |
   | **Headers**    | (leave blank)                                      |
   | **Body template** | (paste this exactly, line by line)            |

   ```json
   {
     "text": "{{message}}",
     "from": "{{sender}}",
     "received_at": "{{time}}",
     "org_id": "PASTE-YOUR-ORG-ID-HERE"
   }
   ```

5. Tap the toggle to **enable** the forwarder, then tap the
   back arrow to dismiss the help screen.

## Test it (30 seconds)

- Have a colleague send you a normal SMS ("hello world" is fine).
- The app will show a green checkmark next to the forwarding rule
  and a "1 sent" counter.
- Done. You do not need to keep the app open — it runs in the
  background and only wakes on incoming SMS.

## What you will see in your notification tray

When an SMS gets forwarded, you will see a notification like:

> **SMS Forwarder** — 200 OK (143ms)

The `200 OK` is the HTTP status code. Anything in the `2xx` range
means the OTP was successfully received by the AG platform.
You do not need to read these notifications.

## What we (the office) will see

Within ~3 seconds of your phone receiving the bank OTP, the
on-duty staff member's Telegram will pop a message like:

> 🔐 **OTP for GRAS / VM-GRAS** from bank KOTAK_MAHINDRA
>
> Your GRAS One Time Password is **482917**. Valid for 5 minutes.
>
> _Reply_ `/claim` _to take this OTP, or_ `/pass` _to release to a colleague._

The staff member taps `/claim` and the OTP is used. **You do not
nothing further — your job is done.** This is the entire goal of
this setup.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No `2xx` in the SMS Forwarder notification | No internet on your phone | Connect to WiFi / data, the forwarder will retry on next SMS |
| `401 Unauthorized` in the notification | `org_id` is wrong / missing | Re-paste the `org_id` from the install email |
| `400 Bad Request` in the notification | Body template is missing `{{message}}` | Re-paste the body template exactly as in step 4 |
| `org_id` for your bank is in the install email. If lost, ask the office for a re-issue. |

## Privacy

- The app only sees **incoming** SMS, not outgoing.
- We store the body of every SMS for 90 days for compliance
  (CIRP, MHADA, NCLT audits all require the audit trail).
- We do **not** see your contacts, your call log, your photos,
  your other apps, or your location. The app's permission set is
  limited to `RECEIVE_SMS` + `READ_SMS` + the notification
  permission.
- The forwarder only sends to the AG platform URL above. It
  cannot be redirected by anyone other than you.

## Uninstall

If you ever need to remove it: open SMS Forwarder → toggle the
rule off → Uninstall the app. The bank will keep working as
before; we will simply stop receiving your OTPs, and the on-duty
staff will get a "no OTP received for KOTAK_MAHINDRA in 60s"
warning in Telegram.

---

**TL;DR for the busy executive**: install SMS Forwarder, paste
the URL `https://intake.agassociates.in/api/v1/webhook/sms-incoming`,
paste the body template, enable the rule, then ignore. Two
minutes.
