import { useMemo } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { FieldActivityLogRow } from '@ag/types';

interface RouteMapProps {
    breadcrumbs: FieldActivityLogRow[];
}

// Renders today's GPS breadcrumbs as a polyline plus start/end markers.
// On Android we explicitly pin to Google Maps (PROVIDER_GOOGLE) so the
// render is consistent across OEM-flavored stock maps. iOS uses Apple Maps
// by default; we don't override that.
export function RouteMap({ breadcrumbs }: RouteMapProps) {
    const coords = useMemo(
        () =>
            breadcrumbs.map((b) => ({
                latitude: Number(b.lat),
                longitude: Number(b.lon),
            })),
        [breadcrumbs],
    );

    if (coords.length === 0) {
        return (
            <View className="h-64 bg-slate-100 rounded-2xl items-center justify-center">
                <Text className="text-sm text-slate-500">
                    No breadcrumbs yet today
                </Text>
            </View>
        );
    }

    const start = coords[0]!;
    const end = coords[coords.length - 1]!;

    return (
        <View className="rounded-2xl overflow-hidden" style={{ height: 320 }}>
            <MapView
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                initialRegion={{
                    latitude: end.latitude,
                    longitude: end.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                }}
            >
                <Polyline
                    coordinates={coords}
                    strokeColor="#4f46e5"
                    strokeWidth={4}
                />
                <Marker
                    coordinate={start}
                    title="Start"
                    description="First sample today"
                    pinColor="#10b981"
                />
                <Marker
                    coordinate={end}
                    title="Latest"
                    description={new Date(
                        breadcrumbs[breadcrumbs.length - 1]!.recorded_at,
                    ).toLocaleTimeString()}
                />
            </MapView>
        </View>
    );
}
