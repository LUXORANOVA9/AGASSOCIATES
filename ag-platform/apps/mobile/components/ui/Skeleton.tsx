import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    const opacity = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.5,
                    duration: 700,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    return (
        <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ opacity }}
            className={`bg-slate-200 rounded-md ${className}`}
        />
    );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
    return (
        <View accessibilityRole="progressbar" className="gap-3">
            {Array.from({ length: rows }).map((_, i) => (
                <View
                    key={i}
                    className="bg-white border border-slate-200 rounded-xl p-4 gap-3"
                >
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                </View>
            ))}
        </View>
    );
}
