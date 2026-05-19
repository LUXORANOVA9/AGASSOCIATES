import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function TabIcon({ name, color }: { name: FeatherName; color: string }) {
    return <Feather name={name} size={22} color={color} />;
}

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#4338ca',
                tabBarInactiveTintColor: '#94a3b8',
                tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
                headerStyle: { backgroundColor: '#0f172a' },
                headerTintColor: '#f8fafc',
                headerTitleStyle: { fontWeight: '600' },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'My Cases',
                    tabBarLabel: 'Cases',
                    tabBarIcon: ({ color }) => <TabIcon name="briefcase" color={color} />,
                }}
            />
            <Tabs.Screen
                name="scanner"
                options={{
                    title: 'Scan',
                    tabBarLabel: 'Scan',
                    tabBarIcon: ({ color }) => <TabIcon name="camera" color={color} />,
                }}
            />
            <Tabs.Screen
                name="activity"
                options={{
                    title: 'Activity',
                    tabBarLabel: 'Activity',
                    tabBarIcon: ({ color }) => <TabIcon name="map-pin" color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarLabel: 'Settings',
                    tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} />,
                }}
            />
        </Tabs>
    );
}
