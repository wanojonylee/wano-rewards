import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { Text } from './Text';

interface ListRowProps {
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  iconTint?: string;
  iconBackground?: string;
  last?: boolean;
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  valueColor,
  onPress,
  chevron = true,
  danger,
  iconTint,
  iconBackground,
  last,
}: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.row, { borderBottomColor: colors.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconBackground ?? colors.surfaceMuted }]}>
          <Feather name={icon} size={17} color={iconTint ?? (danger ? colors.danger : colors.inkSoft)} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" color={danger ? colors.danger : colors.ink} style={{ fontWeight: '600' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="small" color={valueColor ?? colors.muted} style={{ marginRight: 6, fontWeight: '600' }}>
          {value}
        </Text>
      ) : null}
      {onPress && chevron ? <Feather name="chevron-right" size={17} color={colors.lineStrong} /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
