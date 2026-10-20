import React, { useState } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { Segmented } from '../src/components/TextField';
import { Avatar } from '../src/components/Pill';
import { Skeleton } from '../src/components/Skeleton';
import { useLeaderboard } from '../src/lib/hooks';
import { useT } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, radii } from '../src/theme/tokens';
import { formatNumber } from '../src/lib/format';
import { withAlpha } from '../src/lib/color';

export default function Leaderboard() {
  const t = useT();
  const { colors, isDark } = useTheme();
  const [scope, setScope] = useState<'condo' | 'building' | 'city'>('condo');
  const leaderboard = useLeaderboard(scope);

  const rows = leaderboard.data?.rows ?? [];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const me = leaderboard.data?.me ?? null;

  return (
    <Screen scroll>
      <ScreenHeader title={t('home.ranking')} subtitle={t('leader.period')} />

      <Segmented
        value={scope}
        onChange={(value) => setScope(value as typeof scope)}
        options={[
          { value: 'condo', label: t('leader.condo') },
          { value: 'building', label: t('leader.building') },
          { value: 'city', label: t('leader.city') },
        ]}
      />

      {leaderboard.isLoading ? (
        <View style={{ marginTop: spacing.lg, gap: 10 }}>
          <Skeleton height={170} radius={20} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={56} radius={14} />
          ))}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: spacing.xl, gap: 10 }}>
            {[podium[1], podium[0], podium[2]].map((row, index) => {
              if (!row) return <View key={index} style={{ width: 90 }} />;
              const isFirst = row.position === 1;
              return (
                <View key={row.displayName} style={{ alignItems: 'center', width: isFirst ? 106 : 88 }}>
                  <View style={{ position: 'relative' }}>
                    <Avatar name={row.displayName} size={isFirst ? 62 : 50} color={row.avatarColor} />
                    <View
                      style={{
                        position: 'absolute',
                        bottom: -6,
                        right: -6,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: row.position === 1 ? colors.gold : colors.surfaceMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: colors.bg,
                      }}
                    >
                      <Text variant="caption" color={row.position === 1 ? colors.white : colors.inkSoft} style={{ fontSize: 10, fontWeight: '800' }}>
                        {row.position}
                      </Text>
                    </View>
                  </View>
                  <Text variant="caption" numberOfLines={1} style={{ marginTop: 8, fontWeight: '700' }}>
                    {row.displayName.split(' ')[0]}
                  </Text>
                  <Text variant="caption" color={colors.muted} style={{ marginTop: 1 }}>
                    {formatNumber(row.value, 1)} {row.unit}
                  </Text>
                  <View
                    style={{
                      marginTop: 8,
                      width: '100%',
                      height: isFirst ? 74 : 54,
                      borderTopLeftRadius: radii.md,
                      borderTopRightRadius: radii.md,
                      backgroundColor: isFirst ? withAlpha(colors.primary, isDark ? 0.4 : 0.12) : colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name={isFirst ? 'award' : 'trending-up'} size={18} color={isFirst ? colors.gold : colors.muted} />
                  </View>
                </View>
              );
            })}
          </View>

          <Card padded={false} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
            {rest.map((row, index) => (
              <View
                key={row.displayName}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 13,
                  borderBottomWidth: index === rest.length - 1 ? 0 : 1,
                  borderBottomColor: colors.line,
                  backgroundColor: row.isMe ? withAlpha(colors.primary, isDark ? 0.18 : 0.06) : 'transparent',
                }}
              >
                <Text variant="small" color={colors.muted} style={{ width: 26, fontWeight: '700' }}>
                  {row.position}
                </Text>
                <Avatar name={row.displayName} size={34} color={row.avatarColor} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text variant="small" style={{ fontWeight: row.isMe ? '800' : '600' }}>
                    {row.displayName}
                  </Text>
                  {row.isMe ? (
                    <Text variant="caption" color={colors.primary} style={{ marginTop: 1 }}>
                      {t('leader.you')}
                    </Text>
                  ) : null}
                </View>
                <Text variant="small" style={{ fontWeight: '700' }}>
                  {formatNumber(row.value, 1)} {row.unit}
                </Text>
              </View>
            ))}
          </Card>

          {me ? (
            <Card tone="primary" style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: withAlpha(colors.lime, 0.9), alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>
                  {me.position}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text variant="small" color={colors.primaryInk} style={{ fontWeight: '700' }}>
                  {me.displayName} · {t('leader.you')}
                </Text>
                <Text variant="caption" color={withAlpha(colors.primaryInk, 0.65)} style={{ marginTop: 2 }}>
                  {t('leader.monthValue', { value: formatNumber(me.value, 1), unit: me.unit })}
                </Text>
              </View>
              <Feather name="chevron-up" size={18} color={colors.lime} />
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
