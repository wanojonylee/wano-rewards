import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/wano-logo.png')}
      style={{ width: size * 2.28, height: size }}
      resizeMode="contain"
      accessibilityLabel="WANO"
    />
  );
}

export function RvmIllustration({ width = 260, height = 300 }: { width?: number; height?: number }) {
  const { colors, isDark } = useTheme();
  const accent = isDark ? '#8FD6B0' : '#0C3B2A';
  const lime = isDark ? '#CDE87F' : '#D8EE8B';
  const paper = isDark ? '#1F231C' : '#EFEBE1';
  return (
    <Svg width={width} height={height} viewBox="0 0 260 300" fill="none">
      <Circle cx="130" cy="150" r="120" stroke={paper} strokeWidth="1.5" />
      <Circle cx="130" cy="150" r="92" stroke={paper} strokeWidth="1.5" />
      <Circle cx="130" cy="150" r="64" fill={paper} />
      <Path d="M58 196c24 26 58 41 96 37 22-2 42-11 58-25" stroke={lime} strokeWidth="9" strokeLinecap="round" />
      <Path d="M190 171c9 14 12 27 8 38" stroke={lime} strokeWidth="9" strokeLinecap="round" />
      <Path d="M196 206c-2 7-6 12-12 16" stroke={lime} strokeWidth="9" strokeLinecap="round" />
      <G>
        <Rect x="96" y="108" width="68" height="112" rx="14" fill={accent} />
        <Rect x="96" y="108" width="68" height="112" rx="14" stroke={accent} strokeWidth="1.5" />
        <Rect x="116" y="96" width="28" height="14" rx="5" fill={accent} />
        <Rect x="106" y="132" width="48" height="38" rx="8" fill={isDark ? '#0A1F16' : '#E4EEE6'} />
        <Rect x="112" y="140" width="36" height="5" rx="2.5" fill={accent} opacity={0.55} />
        <Rect x="112" y="152" width="24" height="5" rx="2.5" fill={accent} opacity={0.3} />
        <Circle cx="130" cy="190" r="15" stroke={isDark ? '#0A1F16' : '#F6F3EA'} strokeWidth="2" />
        <Path d="M130 182v16M126 186h8" stroke={isDark ? '#0A1F16' : '#F6F3EA'} strokeWidth="2" strokeLinecap="round" />
        <Rect x="118" y="211" width="24" height="3" rx="1.5" fill={isDark ? '#0A1F16' : '#F6F3EA'} opacity={0.4} />
      </G>
      <Path d="M62 102c10-12 24-19 40-20" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
      <Path d="M182 96c8 8 14 17 17 27" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
      <Circle cx="61" cy="101" r="5" fill={lime} />
      <Circle cx="200" cy="123" r="4" fill={lime} />
      <Circle cx="196" cy="224" r="6" stroke={accent} strokeWidth="2" />
      <Circle cx="84" cy="236" r="4" fill={accent} opacity={0.4} />
    </Svg>
  );
}

export function ImpactRing({
  progress,
  size = 96,
  strokeWidth = 8,
  color,
  trackColor,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor ?? colors.surfaceMuted} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? colors.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

export function Sparkline({ values, width = 120, height = 36, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  const { colors } = useTheme();
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const step = width / Math.max(values.length - 1, 1);
  const d = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color ?? colors.primary} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GradientHero({ height = 180 }: { height?: number }) {
  const { isDark } = useTheme();
  return (
    <Svg width="100%" height={height} style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
      <Defs>
        <LinearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={isDark ? '#1C2C23' : '#EAF1E8'} />
          <Stop offset="1" stopColor={isDark ? '#0E100C' : '#F7F4ED'} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={height} fill="url(#hero)" />
    </Svg>
  );
}
