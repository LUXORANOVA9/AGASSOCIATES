import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

// Unencrypted instance for the queue, duty state, query cache. These hold
// UUIDs, case IDs, GPS coords — round-tripped to the server anyway and not
// sensitive in isolation. Sync writes (JSI) eliminate the OS-kill window
// AsyncStorage had between enqueue() and disk flush.
export const storage = new MMKV({ id: 'ag-mobile' });

// Encrypted instance for the Supabase session JWT. Encryption key is a
// 256-bit random value persisted in iOS Keychain / Android Keystore via
// expo-secure-store. On a lost or rooted device, the JWT is not recoverable
// from an MMKV file dump alone — the attacker also needs OS-keystore access.
const SECURE_KEY_NAME = 'ag-mobile-mmkv-secure-key-v1';
const SECURE_INSTANCE_ID = 'ag-mobile-secure';

let secureInstance: MMKV | null = null;
let initPromise: Promise<MMKV> | null = null;

async function readOrCreateKey(): Promise<string> {
    const existing = await SecureStore.getItemAsync(SECURE_KEY_NAME);
    if (existing) return existing;
    const bytes = await Crypto.getRandomBytesAsync(32);
    const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(SECURE_KEY_NAME, key, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    return key;
}

export async function getSecureStorage(): Promise<MMKV> {
    if (secureInstance) return secureInstance;
    if (!initPromise) {
        initPromise = (async () => {
            const key = await readOrCreateKey();
            const inst = new MMKV({ id: SECURE_INSTANCE_ID, encryptionKey: key });
            secureInstance = inst;
            return inst;
        })();
    }
    return initPromise;
}

// Used by the auth flow after an unrecoverable storage error (e.g. corrupted
// MMKV file). Forces re-sign-in by clearing both the encrypted blob and the
// keystore-resident encryption key.
export async function resetSecureStorage(): Promise<void> {
    secureInstance?.clearAll();
    secureInstance = null;
    initPromise = null;
    await SecureStore.deleteItemAsync(SECURE_KEY_NAME);
}
