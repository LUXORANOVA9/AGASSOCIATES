import { getSecureStorage } from '../mmkv';

// Supabase's SupportedStorage accepts an async-shaped interface. We back
// it with the encrypted MMKV instance, lazy-initialised on first use so the
// 256-bit key fetch from SecureStore doesn't block the JS bridge at module
// load.
export const supabaseSecureStorage = {
    async getItem(key: string): Promise<string | null> {
        const s = await getSecureStorage();
        return s.getString(key) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
        const s = await getSecureStorage();
        s.set(key, value);
    },
    async removeItem(key: string): Promise<void> {
        const s = await getSecureStorage();
        s.delete(key);
    },
};
