import * as Sentry from 'sentry-expo';
import { env } from './env';

let initialised = false;

export function initSentry() {
    if (initialised || !env.SENTRY_DSN) return;
    Sentry.init({
        dsn: env.SENTRY_DSN,
        enableInExpoDevelopment: false,
        debug: false,
    });
    initialised = true;
}
