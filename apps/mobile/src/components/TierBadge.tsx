import React from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';
import { radii } from '../theme/tokens';
import { Text } from './Text';
import type { TierCode } from '../types';

const tierIcon: Record<TierCode, React.ComponentProps<typeof Feather>['name']> = {
  seed: 'circle',
  sprout: 'feather',
  forest: 'layers',
  guardian: 'shield',
};

interface TierBadgeProps {
  code: TierCode;
  name: string;
  size?: 'sm' | 'md';
}

export function TierBadge({ code, name, size = 'md' }: TierBadgeProps) {
  const { colors } = useTheme();
  const isSmall = size === 'sm';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.primarySoft,
        borderRadius: radii.pill,
        paddingHorizontal: isSmall ? 9 : 12,
        paddingVertical: isSmall ? 4 : 6,
      }}
    >
      <Feather name={tierIcon[code]} size={isSmall ? 10 : 12} color={colors.primary} style={{ marginRight: 5 }} />
      <Text variant="caption" color={colors.primary} style={{ fontWeight: '700', letterSpacing: 0.4 }}>
        {name}
      </Text>
    </View>
  );
}
