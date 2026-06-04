# @ag/mobile — AG Associates Field App

Expo + Expo Router + Supabase + TanStack Query. Replaces the web PWA at
`ag-platform/src/components/field/FieldApp.tsx` with a real iOS / Android
app.

## Phase 1 scope (this commit)

- Expo SDK 52 + NativeWind v4 + TypeScript strict
- Supabase auth (magic links) with `AsyncStorage` session persistence
- Auth-guarded `/(app)` route group
- Read-only assigned-cases dashboard with:
  - TanStack Query + AsyncStorage-backed cache
  - Pull-to-refresh, skeleton / empty / error states
  - Supabase Realtime subscription on `cases` rows where
    `executive_id = auth.uid()`
- Settings screen, in-app privacy stub linking to the canonical web policy
- Root `ErrorBoundary`, Sentry init (no-op without DSN)

Phase 2 adds the camera, offline mutation queue, and status updates.
Phase 3 adds GPS + push.

## Run locally

```bash
cd ag-platform              # repo workspace root
npm install                 # picks up apps/mobile/ via workspaces
cd apps/mobile
cp .env.example .env        # fill in EXPO_PUBLIC_SUPABASE_URL + ANON_KEY
npm run dev                 # Metro + dev client
```

You need an Expo dev build (not Expo Go) because of native modules
(`async-storage`, `safe-area-context`, etc.):

```bash
npx eas build --profile development --platform android
# install the resulting .apk on a device, then `npm run dev` connects to it
```

## Environment

All vars are non-secret (`EXPO_PUBLIC_*` is bundled into the app):

| Var | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | RLS-bounded anon key |
| `EXPO_PUBLIC_API_BASE_URL` | FastAPI/Express backend (used in Phase 2+) |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional crash reporting |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Hosted privacy policy (DPDP + stores) |

The **service role key never lives in this app.** Anything that needs it
goes through the FastAPI backend or a Supabase Edge Function.

## Architectural rules enforced

- Every file ≤ 200 lines. Split before exceeding.
- Screens are thin orchestrators; logic in `hooks/`, UI in `components/`,
  network in `services/` (added in Phase 2).
- All data-fetching screens render loading / error / empty states.
- App is wrapped in `ErrorBoundary` so a render error never white-screens
  the device.

## What hasn't been verified yet

This package has been **statically authored** but not started in a Metro
bundler from this environment. Run `npm install && npm run type-check`
locally to verify TypeScript resolves the new `@ag/types` re-exports and
all RN imports.
