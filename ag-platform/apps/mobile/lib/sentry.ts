import * as Sentry from '@sentry/react-native';
import { env } from './env';

let initialised = false;

export function initSentry() {
    if (initialised || !env.SENTRY_DSN) return;
    Sentry.init({ dsn: env.SENTRY_DSN, debug: false });
    initialised = true;
}
