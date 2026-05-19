import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useSendMagicLink } from '../hooks/useAuth';

export default function Login() {
    const [email, setEmail] = useState('');
    const { send, sending, sent, error } = useSendMagicLink();

    const submit = () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) return;
        // Deep link the magic-link callback back into the app (scheme set in
        // app.config.ts -> agfield://). Expo handles handing the URL fragment
        // to supabase.auth via the onAuthStateChange listener once we open it.
        send({ email: trimmed, redirectTo: Linking.createURL('/login-callback') });
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-slate-50"
        >
            <View className="flex-1 justify-center px-6">
                <View className="bg-white border border-slate-200 rounded-2xl p-6">
                    <Text className="text-2xl font-semibold text-slate-900 mb-1">
                        AG Associates Field
                    </Text>
                    <Text className="text-sm text-slate-600 mb-6">
                        Sign in with your work email. We&apos;ll send a one-tap login
                        link.
                    </Text>

                    {sent ? (
                        <View className="bg-emerald-50 border border-emerald-200 rounded-md p-3">
                            <Text className="text-sm text-emerald-800">
                                Check your inbox for {email}. Tap the link on this device
                                to finish signing in.
                            </Text>
                        </View>
                    ) : (
                        <>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="you@firm.com"
                                placeholderTextColor="#94a3b8"
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                                inputMode="email"
                                editable={!sending}
                                className="border border-slate-300 rounded-md px-3 py-3 text-base text-slate-900"
                            />
                            {error && (
                                <Text className="text-rose-600 text-xs mt-2">{error}</Text>
                            )}
                            <Pressable
                                onPress={submit}
                                disabled={sending || !email.trim()}
                                className="mt-4 bg-indigo-600 px-4 py-3 rounded-md active:opacity-80 disabled:opacity-50"
                            >
                                <Text className="text-white text-center text-sm font-medium">
                                    {sending ? 'Sending…' : 'Email me a link'}
                                </Text>
                            </Pressable>
                        </>
                    )}

                    <Link href="/privacy" className="mt-6 text-center">
                        <Text className="text-xs text-slate-500 underline">
                            Privacy Policy
                        </Text>
                    </Link>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
