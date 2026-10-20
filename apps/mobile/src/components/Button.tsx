import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: React.ComponentProps<typeof Feather>['name'];
  iconRight?: React.ComponentProps<typeof Feather>['name'];
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const heights: Record<Size, number> = { sm: 40, md: 50, lg: 56 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled,
  loading,
  fullWidth,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const bg = {
    primary: colors.primary,
    secondary: colors.surface,
    ghost: 'transparent',
    accent: colors.lime,
    danger: colors.accentSoft,
  }[variant];
  const fg = {
    primary: colors.primaryInk,
    secondary: colors.ink,
    ghost: colors.ink,
    accent: colors.primary,
    danger: colors.accent,
  }[variant];
  const border = variant === 'secondary' ? colors.line : variant === 'ghost' ? 'transparent' : bg;

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth ? { alignSelf: 'stretch' } : null, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPressIn={() => animate(0.975)}
        onPressOut={() => animate(1)}
        onPress={disabled || loading ? undefined : onPress}
        style={[
          styles.base,
          {
            backgroundColor: bg,
            borderColor: border,
            height: heights[size],
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={styles.row}>
            {icon ? <Feather name={icon} size={17} color={fg} style={{ marginRight: spacing.xs }} /> : null}
            <Text variant={size === 'sm' ? 'small' : 'bodyMedium'} color={fg} style={{ fontWeight: '600' }}>
              {label}
            </Text>
            {iconRight ? <Feather name={iconRight} size={17} color={fg} style={{ marginLeft: spacing.xs }} /> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
