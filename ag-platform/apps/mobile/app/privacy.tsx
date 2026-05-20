import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { env } from '../lib/env';

// In-app privacy entry point. The canonical, always-current policy text lives
// at env.PRIVACY_POLICY_URL (rendered by the web app's /privacy route — single
// source of truth). This screen explains that and offers a button to open it.
export default function PrivacyScreen() {
    const router = useRouter();
    const url = env.PRIVACY_POLICY_URL;

    return (
        <ScrollView className="flex-1 bg-slate-50">
            <View className="p-6 gap-4">
                <Text className="text-2xl font-semibold text-slate-900">
                    Privacy Policy
                </Text>
                <Text className="text-sm text-slate-700 leading-relaxed">
                    AG Associates handles your personal data in compliance with India&apos;s
                    Digital Personal Data Protection Act, 2023. The full policy — including
                    what we collect, the named processors we use (Supabase, Sentry,
                    PostHog, WhatsApp, Resend), your DPDP rights, and our retention rules —
                    is hosted on our website.
                </Text>
                <Pressable
                    onPress={() => Linking.openURL(url)}
                    className="bg-indigo-600 px-4 py-3 rounded-md active:opacity-80"
                >
                    <Text className="text-white text-center text-sm font-medium">
                        Open full policy
                    </Text>
                </Pressable>
                <Text className="text-xs text-slate-500">{url}</Text>
                <Pressable
                    onPress={() => router.back()}
                    className="border border-slate-300 px-4 py-3 rounded-md active:opacity-80"
                >
                    <Text className="text-slate-700 text-center text-sm font-medium">
                        Back
                    </Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}
