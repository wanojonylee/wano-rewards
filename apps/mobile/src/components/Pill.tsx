import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { Text } from './Text';

interface PillProps {
  label: string;
  tone?: 'neutral' | 'primary' | 'lime' | 'accent' | 'outline' | 'danger';
  icon?: React.ComponentProps<typeof Feather>['name'];
  active?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
}

export function Pill({ label, tone = 'neutral', icon, active, onPress, size = 'md' }: PillProps) {
  const { colors } = useTheme();
  const palette = {
    neutral: { bg: colors.surfaceMuted, fg: colors.inkSoft, border: 'transparent' },
    primary: { bg: colors.primarySoft, fg: colors.primary, border: 'transparent' },
    lime: { bg: colors.lime, fg: colors.primary, border: 'transparent' },
    accent: { bg: colors.accentSoft, fg: colors.accent, border: 'transparent' },
    danger: { bg: colors.accentSoft, fg: colors.danger, border: 'transparent' },
    outline: { bg: 'transparent', fg: colors.inkSoft, border: colors.line },
  }[tone];
  const bg = active ? colors.primary : palette.bg;
  const fg = active ? colors.primaryInk : palette.fg;

  const body = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderColor: active ? colors.primary : palette.border,
          paddingVertical: size === 'sm' ? 5 : 9,
          paddingHorizontal: size === 'sm' ? 10 : 14,
        },
      ]}
    >
      {icon ? <Feather name={icon} size={size === 'sm' ? 11 : 13} color={fg} style={{ marginRight: 6 }} /> : null}
      <Text variant={size === 'sm' ? 'caption' : 'small'} color={fg} style={{ fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {body}
    </Pressable>
  );
}

interface ProgressBarProps {
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
}

export function ProgressBar({ value, height = 8, color, trackColor }: ProgressBarProps) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: trackColor ?? colors.surfaceMuted, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color ?? colors.primary }} />
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, eyebrow, actionLabel, onAction }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text variant="label" color={colors.muted} style={{ marginBottom: 6 }}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h2">{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="small" color={colors.muted} style={{ fontWeight: '600', marginRight: 2 }}>
            {actionLabel}
          </Text>
          <Feather name="arrow-up-right" size={14} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
}

export function Avatar({ name, color, size = 44 }: AvatarProps) {
  const { colors } = useTheme();
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const textColor = color ? contrastText(color) : colors.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ?? colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant={size >= 40 ? 'bodyMedium' : 'caption'} color={textColor} style={{ fontWeight: '700' }}>
        {initials}
      </Text>
    </View>
  );
}

function contrastText(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? '#14160F' : '#FFFFFF';
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});
