import React, { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceMuted, opacity }, style]}
    />
  );
}

export function ScreenSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20 }}>
      <Skeleton width="45%" height={14} style={{ marginTop: 8 }} />
      <Skeleton width="70%" height={34} style={{ marginTop: 14 }} />
      <Skeleton height={150} radius={20} style={{ marginTop: 24 }} />
      <View style={{ flexDirection: 'row', marginTop: 20, gap: 12 }}>
        <Skeleton width="48%" height={90} radius={16} />
        <Skeleton width="48%" height={90} radius={16} />
      </View>
      <Skeleton height={80} radius={16} style={{ marginTop: 20 }} />
      <Skeleton height={80} radius={16} style={{ marginTop: 12 }} />
    </View>
  );
}
