import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
  elevated?: boolean;
  tone?: 'surface' | 'muted' | 'primary' | 'lime';
}

export function Card({ children, onPress, style, padded = true, elevated, tone = 'surface' }: CardProps) {
  const { colors } = useTheme();
  const bg = {
    surface: colors.surface,
    muted: colors.surfaceMuted,
    primary: colors.primary,
    lime: colors.lime,
  }[tone];

  const content = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderColor: tone === 'surface' ? colors.line : 'transparent',
          padding: padded ? spacing.lg : 0,
        },
        elevated
          ? { shadowColor: colors.shadow, shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      {content}
    </Pressable>
  );
}

interface IconButtonProps {
  name: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  size?: number;
  tint?: string;
  background?: string;
  bordered?: boolean;
  accessibilityLabel?: string;
}

export function IconButton({ name, onPress, size = 40, tint, background, bordered = true, accessibilityLabel }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background ?? colors.surface,
        borderWidth: bordered ? 1 : 0,
        borderColor: colors.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather name={name} size={Math.round(size * 0.42)} color={tint ?? colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    borderWidth: 1,
  },
});
