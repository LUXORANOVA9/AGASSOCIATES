import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { env } from '../lib/env';
import {
    POLICY_CONTACT_EMAIL,
    POLICY_DPO_EMAIL,
    POLICY_LAST_UPDATED,
    POLICY_SECTIONS,
} from '../lib/privacy-sections';
import { withErrorBoundary } from '../components/ui';

function PrivacyScreen() {
    const router = useRouter();

    return (
        <ScrollView className="flex-1 bg-slate-50">
            <View className="p-6 gap-4">
                <Text className="text-2xl font-semibold text-slate-900">
                    Privacy Policy
                </Text>
                <Text className="text-xs text-slate-500">
                    Effective {POLICY_LAST_UPDATED} · DPDP Act 2023 compliant
                </Text>

                {POLICY_SECTIONS.map((section) => (
                    <View key={section.title} className="gap-2">
                        <Text className="text-base font-semibold text-slate-900 mt-2">
                            {section.title}
                        </Text>
                        {section.paragraphs.map((p, i) => (
                            <Text
                                key={i}
                                className="text-sm text-slate-700 leading-relaxed"
                            >
                                {p}
                            </Text>
                        ))}
                        {section.bullets?.map((b) => (
                            <View key={b} className="flex-row pl-3">
                                <Text className="text-sm text-slate-700 mr-2">•</Text>
                                <Text className="text-sm text-slate-700 flex-1 leading-relaxed">
                                    {b}
                                </Text>
                            </View>
                        ))}
                    </View>
                ))}

                <View className="gap-2 mt-2">
                    <Text className="text-base font-semibold text-slate-900">
                        10. Contact
                    </Text>
                    <Pressable
                        onPress={() => Linking.openURL(`mailto:${POLICY_CONTACT_EMAIL}`)}
                    >
                        <Text className="text-sm text-indigo-700">
                            Privacy team: {POLICY_CONTACT_EMAIL}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => Linking.openURL(`mailto:${POLICY_DPO_EMAIL}`)}
                    >
                        <Text className="text-sm text-indigo-700">
                            Data Protection Officer: {POLICY_DPO_EMAIL}
                        </Text>
                    </Pressable>
                </View>

                <Pressable
                    onPress={() => Linking.openURL(env.PRIVACY_POLICY_URL)}
                    className="border border-slate-300 px-4 py-3 rounded-md active:bg-slate-100 mt-4"
                >
                    <Text className="text-slate-700 text-center text-sm">
                        View latest policy on the web
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => router.back()}
                    className="px-4 py-3 rounded-md active:opacity-60"
                >
                    <Text className="text-indigo-700 text-center text-sm font-medium">
                        Back
                    </Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

export default withErrorBoundary(PrivacyScreen);
