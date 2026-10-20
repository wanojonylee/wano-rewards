import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/Pill';
import { ListRow } from '../../src/components/ListRow';
import { TierBadge } from '../../src/components/TierBadge';
import { Sheet } from '../../src/components/Sheet';
import { Button } from '../../src/components/Button';
import { Avatar } from '../../src/components/Pill';
import { useProfile, useNotifications } from '../../src/lib/hooks';
import { useT, usePrefs } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing } from '../../src/theme/tokens';
import { formatDateFull, formatPoints } from '../../src/lib/format';
import { useAuth } from '../../src/store/auth';

export default function Profile() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const locale = usePrefs((s) => s.locale);
  const profile = useProfile();
  const notifications = useNotifications();
  const signOut = useAuth((s) => s.signOut);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const data = profile.data;
  const tier = data?.tier;
  const points = data?.wallet.points ?? 0;
  const nextMin = tier?.nextTierMinPoints ?? (tier ? tier.minPoints + tier.pointsToNext : 1);
  const span = tier && tier.nextTier ? Math.max(1, nextMin - tier.minPoints) : 1;
  const tierProgress = tier && tier.nextTier ? Math.max(0, Math.min(1, 1 - (tier.pointsToNext || 0) / span)) : 1;

  return (
    <Screen scroll edges={['top']} bottomInset={100}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm }}>
        <Text variant="h1">{t('profile.title')}</Text>
        <Pressable onPress={() => router.push('/settings')} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="settings" size={17} color={colors.ink} />
        </Pressable>
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={data?.user.name ?? 'Marina Costa'} size={58} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text variant="h2">{data?.user.name ?? '—'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
              {tier ? <TierBadge code={tier.code} name={tier.name} size="sm" /> : null}
              {data ? (
                <Text variant="caption" color={colors.muted}>
                  {t('profile.since', { date: formatDateFull(data.user.memberSince, locale) })}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
            <Text variant="caption" color={colors.muted}>
              {tier?.nextTier ? t('profile.nextTier', { points: formatPoints(tier.pointsToNext), tier: tier.nextTier }) : t('profile.maxTier')}
            </Text>
            <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
              {formatPoints(points)} pts
            </Text>
          </View>
          <ProgressBar value={tierProgress} height={6} />
        </View>

        <View style={{ flexDirection: 'row', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line }}>
          {[
            { label: t('impact.kg'), value: `${(data?.stats.kgTotal ?? 0).toFixed(1)}` },
            { label: t('impact.sessions'), value: `${data?.stats.sessionsTotal ?? 0}` },
            { label: t('impact.items'), value: `${data?.stats.itemsTotal ?? 0}` },
          ].map((stat, index) => (
            <View key={stat.label} style={{ flex: 1, alignItems: index === 0 ? 'flex-start' : 'center', borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: colors.line }}>
              <Text variant="h3">{stat.value}</Text>
              <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Text variant="label" color={colors.muted} style={{ marginBottom: 6, marginLeft: 4 }}>
          {t('profile.sectionAccount')}
        </Text>
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <ListRow icon="credit-card" title={t('profile.wallet')} value={formatPoints(points) + ' pts'} onPress={() => router.push('/wallet')} />
          <ListRow icon="gift" title={t('profile.orders')} onPress={() => router.push('/orders')} />
          <ListRow icon="users" title={t('profile.referral')} onPress={() => router.push('/referral')} />
          <ListRow icon="map-pin" title={t('profile.machines')} onPress={() => router.push('/machines')} />
          <ListRow icon="bell" title={t('profile.notifications')} value={notifications.data?.unread ? String(notifications.data.unread) : undefined} onPress={() => router.push('/notifications')} last />
        </Card>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text variant="label" color={colors.muted} style={{ marginBottom: 6, marginLeft: 4 }}>
          {t('profile.sectionSupport')}
        </Text>
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <ListRow icon="sliders" title={t('profile.settings')} onPress={() => router.push('/settings')} />
          <ListRow icon="shield" title={t('profile.privacy')} onPress={() => router.push('/privacy')} />
          <ListRow icon="help-circle" title={t('profile.help')} onPress={() => router.push('/help')} last />
        </Card>
      </View>

      <Pressable onPress={() => setLogoutOpen(true)} style={{ marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
        <Feather name="log-out" size={16} color={colors.danger} />
        <Text variant="small" color={colors.danger} style={{ marginLeft: 6, fontWeight: '600' }}>
          {t('profile.logout')}
        </Text>
      </Pressable>
      <Text variant="caption" color={colors.muted} align="center" style={{ marginTop: 4 }}>
        WANO Rewards v1.0.0 · {t('settings.demoMode')}
      </Text>

      <Sheet visible={logoutOpen} onClose={() => setLogoutOpen(false)} title={t('profile.logoutConfirm')}>
        <Button
          label={t('profile.logout')}
          variant="danger"
          fullWidth
          size="lg"
          onPress={async () => {
            setLogoutOpen(false);
            await signOut();
            router.replace('/(auth)/sign-in');
          }}
        />
        <Button label={t('common.cancel')} variant="ghost" fullWidth style={{ marginTop: 6 }} onPress={() => setLogoutOpen(false)} />
        <View style={{ height: insets.bottom }} />
      </Sheet>
    </Screen>
  );
}

