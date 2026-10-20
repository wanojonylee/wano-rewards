import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Pill } from '../src/components/Pill';
import { Skeleton } from '../src/components/Skeleton';
import { useLedger, useProfile } from '../src/lib/hooks';
import { useT, usePrefs } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/tokens';
import { formatBRL, formatPoints, timeAgo } from '../src/lib/format';
import { withAlpha } from '../src/lib/color';

const filters = [
  { value: 'all', key: 'wallet.filter.all' },
  { value: 'earn', key: 'wallet.filter.earn' },
  { value: 'redeem', key: 'wallet.filter.redeem' },
  { value: 'payout', key: 'wallet.filter.payout' },
  { value: 'topup', key: 'wallet.filter.topup' },
];

export default function Wallet() {
  const t = useT();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const locale = usePrefs((s) => s.locale);
  const profile = useProfile();
  const [filter, setFilter] = useState('all');
  const ledger = useLedger(filter === 'all' ? undefined : filter);
  const wallet = profile.data?.wallet;

  return (
    <Screen scroll>
      <ScreenHeader title={t('wallet.title')} />

      <Card style={{ overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -40, top: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: withAlpha(colors.primary, isDark ? 0.18 : 0.06) }} />
        <Text variant="label" color={colors.muted}>
          {t('wallet.balanceLabel')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text variant="display" style={{ fontSize: 42, lineHeight: 46 }}>
              {wallet ? formatPoints(wallet.points) : '—'}
            </Text>
            <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
              {t('wallet.points')}
            </Text>
          </View>
          <View style={{ width: 1, height: 46, backgroundColor: colors.line, marginHorizontal: spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text variant="display" style={{ fontSize: 42, lineHeight: 46 }}>
              {wallet ? formatBRL(wallet.creditCents) : '—'}
            </Text>
            <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
              {t('wallet.credit')}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.md, padding: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Feather name="arrow-down-circle" size={14} color={colors.success} />
          <Text variant="caption" color={colors.muted} style={{ marginLeft: 6, flex: 1 }}>
            {t('wallet.withdrawable')}
          </Text>
          <Text variant="small" style={{ fontWeight: '700' }}>
            {wallet ? formatBRL(wallet.withdrawableCents) : '—'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button label={t('wallet.addCreditShort')} size="sm" onPress={() => router.push('/checkout')} icon="plus" fullWidth />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t('wallet.withdrawShort')} size="sm" variant="secondary" onPress={() => router.push('/payout')} icon="send" fullWidth />
          </View>
        </View>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Text variant="h3" style={{ marginBottom: spacing.sm }}>
          {t('wallet.history')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
          {filters.map((item) => (
            <Pill key={item.value} label={t(item.key)} active={filter === item.value} onPress={() => setFilter(item.value)} tone="outline" size="sm" />
          ))}
        </View>

        {ledger.isLoading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={64} radius={14} />
            ))}
          </View>
        ) : (ledger.data?.items.length ?? 0) === 0 ? (
          <Text variant="small" color={colors.muted} style={{ paddingVertical: spacing.lg }}>
            {t('wallet.empty')}
          </Text>
        ) : (
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {ledger.data?.items.map((entry, index, array) => {
              const isMoney = entry.creditDeltaCents !== 0 && entry.pointsDelta === 0;
              const positive = entry.pointsDelta > 0 || entry.creditDeltaCents > 0;
              const icon =
                entry.type === 'redeem'
                  ? 'gift'
                  : entry.type === 'payout'
                    ? 'send'
                    : entry.type === 'bonus'
                      ? 'award'
                      : entry.type === 'referral'
                        ? 'users'
                        : entry.type === 'topup'
                          ? 'credit-card'
                          : entry.type === 'mini_market'
                            ? 'shopping-bag'
                            : entry.type === 'expire'
                              ? 'clock'
                              : 'refresh-cw';
              return (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 13,
                    borderBottomWidth: index === array.length - 1 ? 0 : 1,
                    borderBottomColor: colors.line,
                  }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name={icon as any} size={15} color={colors.inkSoft} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text variant="small" numberOfLines={1} style={{ fontWeight: '600' }}>
                      {entry.description}
                    </Text>
                    <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                      {timeAgo(entry.createdAt, locale)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {entry.pointsDelta !== 0 ? (
                      <Text variant="small" color={positive ? colors.success : colors.inkSoft} style={{ fontWeight: '700' }}>
                        {entry.pointsDelta > 0 ? '+' : ''}
                        {formatPoints(entry.pointsDelta)} pts
                      </Text>
                    ) : null}
                    {entry.creditDeltaCents !== 0 ? (
                      <Text variant="caption" color={isMoney ? (positive ? colors.success : colors.accent) : colors.muted} style={{ fontWeight: '600', marginTop: 2 }}>
                        {entry.creditDeltaCents > 0 ? '+' : '-'}
                        {formatBRL(Math.abs(entry.creditDeltaCents))}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </Screen>
  );
}

