# Mobile assets

These files are required for Expo to build the app. They are intentionally
**not** committed because they are binary product-design artifacts the
design team owns — committing placeholders here would silently ship them
to the App Store / Play Store. Add the real PNGs before running EAS:

| File | Size | Notes |
|---|---|---|
| `icon.png` | 1024×1024 PNG, no transparency | Used as the iOS app icon and Android legacy icon. |
| `adaptive-icon.png` | 1024×1024 PNG | Android adaptive icon foreground. Background is `#0f172a` (set in `app.config.ts`). |
| `splash.png` | 1242×2436 PNG | Logo-on-dark splash. Background is `#0f172a`. |

You can generate the three from a single 1024×1024 master with
`npx @expo/configure-splash-screen` or the design team's existing toolchain.

EAS Build will fail loudly if any of these are missing — that's by
design, so we don't accidentally ship a placeholder.
