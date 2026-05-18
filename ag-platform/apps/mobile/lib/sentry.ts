import * as Sentry from 'sentry-expo';
import { env } from './env';
import { usePreferencesStore } from './stores/usePreferencesStore';

let initialised = false;

// Sentry is only initialised if (a) a DSN is configured and (b) the user
// hasn't opted out via diagnosticsEnabled in their preferences. The user
// toggle is honored at init time only — flipping it during a session takes
// effect on next launch. (Sentry doesn't expose a clean runtime disable in
// the Expo SDK.)
export function initSentry() {
    if (initialised || !env.SENTRY_DSN) return;
    const diagnosticsEnabled = usePreferencesStore.getState().diagnosticsEnabled;
    if (!diagnosticsEnabled) return;
    Sentry.init({
        dsn: env.SENTRY_DSN,
        enableInExpoDevelopment: false,
        debug: false,
    });
    initialised = true;
}
