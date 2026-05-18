# Field App — Release Checklist

Pre-launch gate for the AG Associates Field app. Walk this top-to-bottom
before submitting to TestFlight or the Play Console Internal track.

## 1. Code & config

- [ ] `npm install` succeeds from a clean clone
- [ ] `npm run type-check` clean in `apps/mobile/`
- [ ] `npm test` green (queue drain tests)
- [ ] `.env` populated with **production** Supabase URL + anon key
- [ ] `EXPO_PUBLIC_PRIVACY_POLICY_URL` points to the live hosted policy
- [ ] `EXPO_PUBLIC_API_BASE_URL` points at the production FastAPI/Express
- [ ] `EXPO_PUBLIC_SENTRY_DSN` set (and the project exists in Sentry)
- [ ] EAS Secrets contain the same set, plus `EAS_PROJECT_ID` plumbed into `app.config.ts`'s `updates.url`

## 2. Assets

- [ ] `assets/icon.png` (1024×1024) — real design, not placeholder
- [ ] `assets/adaptive-icon.png` (1024×1024) — real design
- [ ] `assets/splash.png` (1242×2436) — real design
- [ ] All assets under `~500 KB` each (EAS upload speed)

## 3. Backend & schema

- [ ] Phase 0 migration applied to production Supabase
  (`20260518000000_field_app.sql` — `executive_id`, `documents`,
  `case_audit_logs`, `field_activity_logs`, `device_push_tokens`)
- [ ] Phase 3 push trigger migration applied
  (`20260519000000_push_trigger.sql`)
- [ ] Supabase Vault entries set:
  - `edge_send_push_url` = invocation URL for `send-push-on-case-assigned`
  - `edge_function_secret` = bearer string
- [ ] Edge Function deployed:
  `supabase functions deploy send-push-on-case-assigned`
- [ ] Storage bucket `documents` exists and is **private**

## 4. Auth

- [ ] Supabase Auth → URL Configuration includes `agfield://login-callback`
- [ ] Custom Access Token hook populates `app_metadata.app_org_id` (NOT
  the dev stub from `20260514000001_auth_hooks.sql:26`)
- [ ] At least one real EXECUTIVE-role user provisioned for QA

## 5. Permissions copy

Walk the actual permission prompts on a clean install:

- [ ] Camera prompt shows the AG Associates copy from `app.config.ts`
- [ ] Location prompt shows "while on duty" copy
- [ ] Notification prompt fires after login (not on first launch)

## 6. Flow smoke test (real device, on a slow network)

- [ ] Magic-link login round-trip
- [ ] Dashboard renders skeleton → cases → empty state
- [ ] Pull-to-refresh works
- [ ] Realtime: update a `cases` row in Supabase Studio → dashboard updates
- [ ] Scan a document in airplane mode → reconnect → file lands in
  `documents` row + Storage bucket
- [ ] Tap a status button in airplane mode → reconnect → `case_audit_logs`
  row + `cases.status` updated
- [ ] Toggle on-duty → walk ~50m → breadcrumbs appear in
  `field_activity_logs` and on the activity map
- [ ] In Supabase, assign a case to the QA user → push arrives → tap →
  app opens to `/cases/[id]`
- [ ] Force an error inside a screen (`throw new Error('test')`) →
  ErrorBoundary fallback shows → retry resets without restart
- [ ] Settings → toggle diagnostics off → kill app → reopen → Sentry not
  initialised this launch
- [ ] Sign out → returns to `/login`; pending queue items persist for
  next user (intentional? confirm with product before launch — if no,
  reset queue on signOut)

## 7. Store metadata

### Play Console
- [ ] App name: "AG Associates Field"
- [ ] Short description + full description authored
- [ ] Data Safety form completed (Sentry, Supabase, location while on
  duty, camera, notification permission)
- [ ] Content rating: Everyone (Business)
- [ ] Privacy policy URL set to `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- [ ] Screenshots (phone, 16:9 + 9:16): dashboard, scanner, case detail,
  activity map, settings (5 minimum)
- [ ] Feature graphic 1024×500

### App Store Connect
- [ ] Name, subtitle, description, keywords
- [ ] Privacy policy URL set
- [ ] Privacy Nutrition Labels: Diagnostics (linked, opt-out),
  Location (linked, while on duty), Photos (linked, scans)
- [ ] Screenshots (6.7", 5.5") matching Play Console set
- [ ] Encryption declaration: `ITSAppUsesNonExemptEncryption = false`
  set in `app.config.ts` (HTTPS only, no custom crypto)

## 8. Build & submit

```bash
cd apps/mobile

# Production-channel build, autoIncrement on
npx eas build --profile production --platform all

# Internal track distribution
npx eas submit --profile production --platform android
npx eas submit --profile production --platform ios
```

## 9. Post-launch (week 1)

- [ ] Sentry alerts: bind to `#mobile-alerts` Slack channel
- [ ] First on-call rotation set (someone owns the inbox for 7 days)
- [ ] Test re-installation flow on a real device (token rotation,
  queue state cleared from previous user)
- [ ] Push delivery rate sanity check (Expo Push API dashboard)
- [ ] Field-team feedback channel open + triaged twice/day
