import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import Constants from 'expo-constants';

export default function Settings() {
    const router = useRouter();
    const { user, role, orgId, signOut } = useAuth();
    const version = Constants.expoConfig?.version ?? '0.0.0';

    return (
        <ScrollView className="flex-1 bg-slate-50">
            <View className="p-4 gap-4">
                <Section title="Account">
                    <Row label="Email" value={user?.email ?? '—'} />
                    <Row label="Role" value={role ?? '—'} />
                    <Row label="Organization" value={orgId ?? '—'} />
                </Section>

                <Section title="Tools">
                    <Link href="/scanner" asChild>
                        <Pressable className="py-3">
                            <Text className="text-indigo-700 text-sm">Scan a document</Text>
                        </Pressable>
                    </Link>
                    <Link href="/activity" asChild>
                        <Pressable className="py-3">
                            <Text className="text-indigo-700 text-sm">
                                Activity &amp; route
                            </Text>
                        </Pressable>
                    </Link>
                    {__DEV__ && (
                        <Link href={'/debug/queue' as never} asChild>
                            <Pressable className="py-3">
                                <Text className="text-indigo-700 text-sm">
                                    Mutation queue (dev)
                                </Text>
                            </Pressable>
                        </Link>
                    )}
                </Section>

                <Section title="About">
                    <Row label="App version" value={version} />
                    <Link href="/privacy" asChild>
                        <Pressable className="py-3">
                            <Text className="text-indigo-700 text-sm">
                                Privacy Policy
                            </Text>
                        </Pressable>
                    </Link>
                </Section>

                <Pressable
                    onPress={async () => {
                        await signOut();
                        router.replace('/login');
                    }}
                    className="bg-rose-600 px-4 py-3 rounded-md active:opacity-80"
                >
                    <Text className="text-white text-center text-sm font-medium">
                        Sign out
                    </Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View className="bg-white border border-slate-200 rounded-2xl p-4">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {title}
            </Text>
            {children}
        </View>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-row justify-between py-2 border-b border-slate-100 last:border-b-0">
            <Text className="text-sm text-slate-600">{label}</Text>
            <Text className="text-sm text-slate-900 font-medium">{value}</Text>
        </View>
    );
}
