import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { ProgressBar, SectionHeader, Avatar } from '../../src/components/Pill';
import { CampaignCard } from '../../src/components/RewardTile';
import { ScreenSkeleton } from '../../src/components/Skeleton';
import { ImpactRing, Sparkline } from '../../src/components/Illustrations';
import { TierBadge } from '../../src/components/TierBadge';
import { useHome, useNotifications, useProfile } from '../../src/lib/hooks';
import { useT } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, radii } from '../../src/theme/tokens';
import { formatBRL, formatPoints, greetingKey, timeAgo } from '../../src/lib/format';
import { usePrefs } from '../../src/store/prefs';
import { withAlpha } from '../../src/lib/color';

export default function Home() {
  const t = useT();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const locale = usePrefs((s) => s.locale);
  const home = useHome();
  const profile = useProfile();
  const notifications = useNotifications();
  const unread = notifications.data?.unread ?? 0;

  if (home.isLoading || !home.data) {
    if (home.isError) {
      return (
        <Screen>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="h3">{t('common.error')}</Text>
            <Text variant="small" color={colors.muted} style={{ marginTop: 6 }} onPress={() => home.refetch()}>
              {t('common.retry')}
            </Text>
          </View>
        </Screen>
      );
    }
    return <ScreenSkeleton />;
  }

  const data = home.data;
  const name = profile.data?.user.name.split(' ')[0] ?? data.greetingName;
  const goalRatio = data.weeklyGoal.current / data.weeklyGoal.target;
  const recent = data.recent.slice(0, 4);

  return (
    <Screen scroll edges={['top']} refreshing={home.isRefetching} onRefresh={() => home.refetch()}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm }}>
        <View>
          <Text variant="caption" color={colors.muted} style={{ letterSpacing: 1.4, fontWeight: '700' }}>
            WANO REWARDS
          </Text>
          <Text variant="h2" style={{ marginTop: 4 }}>
            {t(greetingKey(), { name })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
            <Feather name="bell" size={18} color={colors.ink} />
            {unread > 0 ? (
              <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.surface }} />
            ) : null}
          </Pressable>
          <Pressable onPress={() => router.push('/profile')}>
            <Avatar name={name} color={colors.primary} size={40} />
          </Pressable>
        </View>
      </View>

      {/* balance */}
      <Card style={{ marginTop: spacing.xl, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -30, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: withAlpha(colors.primary, isDark ? 0.16 : 0.06) }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="label" color={colors.muted}>
            {t('home.balance')}
          </Text>
          <TierBadge code={data.tier.code} name={data.tier.name} size="sm" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 }}>
          <Text variant="display" style={{ fontSize: 54, lineHeight: 58 }}>
            {formatPoints(data.wallet.points)}
          </Text>
          <Text variant="body" color={colors.muted} style={{ marginLeft: 8, marginBottom: 9 }}>
            {t('common.points')}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: colors.line, marginVertical: spacing.md }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text variant="caption" color={colors.muted}>
              {t('home.credit')}
            </Text>
            <Text variant="h3" style={{ marginTop: 2 }}>
              {formatBRL(data.wallet.creditCents)}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/wallet')} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
              {t('profile.wallet')}
            </Text>
            <Feather name="arrow-up-right" size={14} color={colors.primary} style={{ marginLeft: 3 }} />
          </Pressable>
        </View>
      </Card>

      {/* scan CTA */}
      <Pressable onPress={() => router.push('/scan')} style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1, marginTop: spacing.md })}>
        <View style={{ backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.lg, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -28, top: -34, width: 120, height: 120, borderRadius: 60, borderWidth: 20, borderColor: withAlpha(colors.lime, 0.18) }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text variant="h2" color={colors.primaryInk}>
                {t('home.scanTitle')}
              </Text>
              <Text variant="small" color={withAlpha(colors.primaryInk, 0.72)} style={{ marginTop: 4 }}>
                {data.nearbyMachine
                  ? t('home.scanNear', { distance: data.nearbyMachine.distanceMeters, name: data.nearbyMachine.name })
                  : t('home.scanBody')}
              </Text>
            </View>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="maximize" size={22} color={colors.primary} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime, marginRight: 6 }} />
            <Text variant="caption" color={withAlpha(colors.primaryInk, 0.7)}>
              {data.nearbyMachine?.status === 'online' ? t('home.scanStatus') : t('scan.nearby')}
            </Text>
            <Feather name="arrow-right" size={14} color={colors.primaryInk} style={{ marginLeft: 'auto' }} />
          </View>
        </View>
      </Pressable>

      {/* weekly goal */}
      <Card tone="muted" style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text variant="caption" color={colors.muted} style={{ fontWeight: '600' }}>
              {t('home.weeklyGoal')}
            </Text>
            <Text variant="h3" style={{ marginTop: 2 }}>
              {goalRatio >= 1 ? t('home.weeklyGoalDone') : t('home.weeklyGoalValue', { current: data.weeklyGoal.current, target: data.weeklyGoal.target })}
            </Text>
          </View>
          <Text variant="h3" color={colors.primary}>
            {Math.round(goalRatio * 100)}%
          </Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <ProgressBar value={goalRatio} height={7} />
        </View>
      </Card>

      {/* campaigns */}
      {data.campaigns.length > 0 ? (
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader
            title={t('home.campaigns')}
            actionLabel={t('common.seeAll')}
            onAction={() => router.push(data.campaigns[0] ? `/campaign/${data.campaigns[0].id}` : '/leaderboard')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: spacing.lg }} style={{ marginHorizontal: -spacing.lg }}>
            {data.campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                title={campaign.title}
                subtitle={campaign.subtitle}
                brand={campaign.brand}
                accent={campaign.accent}
                multiplier={campaign.multiplier}
                bonusPoints={campaign.bonusPoints}
                progress={campaign.progress}
                joined={campaign.joined}
                onPress={() => router.push(`/campaign/${campaign.id}`)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ranking */}
      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title={t('home.ranking')} actionLabel={t('common.seeAll')} onAction={() => router.push('/leaderboard')} />
        <Card onPress={() => router.push('/leaderboard')}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="h2" color={colors.primary}>
                #{data.rank.condo.position}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="bodyMedium" style={{ fontWeight: '700' }}>
                {t('home.rankingValue', { position: data.rank.condo.position, total: data.rank.condo.total })}
              </Text>
              <Text variant="caption" color={colors.muted} style={{ marginTop: 3, lineHeight: 17 }}>
                {t('home.rankingBody', { percentile: data.rank.condo.percentile ?? 10 })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {['A', 'B', 'C'].map((letter, index) => (
                <View key={letter} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                  <Avatar name={letter + ' Silva'} size={26} color={colors.lineStrong} />
                </View>
              ))}
            </View>
          </View>
        </Card>
      </View>

      {/* impact */}
      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title={t('home.impact')} actionLabel={t('common.seeAll')} onAction={() => router.push('/impact')} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" color={colors.muted}>
                {t('home.kg')}
              </Text>
              <Feather name="trending-up" size={14} color={colors.success} />
            </View>
            <Text variant="hero" style={{ fontSize: 30, lineHeight: 34, marginTop: 6 }}>
              {data.stats.kgTotal.toFixed(1)}
            </Text>
            <Sparkline values={[14, 19, 16, 24, 28, 31]} width={110} height={30} />
          </Card>
          <Card style={{ flex: 1 }}>
            <Text variant="caption" color={colors.muted}>
              {t('home.co2')}
            </Text>
            <Text variant="hero" style={{ fontSize: 30, lineHeight: 34, marginTop: 6 }}>
              {data.stats.co2SavedKg.toFixed(1)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Feather name="wind" size={13} color={colors.muted} />
              <Text variant="caption" color={colors.muted} style={{ marginLeft: 5 }}>
                {data.stats.itemsTotal} {t('impact.items')}
              </Text>
            </View>
          </Card>
        </View>
      </View>

      {/* recent */}
      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title={t('home.recent')} actionLabel={t('common.seeAll')} onAction={() => router.push('/wallet')} />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {recent.length === 0 ? (
            <Text variant="small" color={colors.muted} style={{ paddingVertical: spacing.lg }}>
              {t('home.emptyRecent')}
            </Text>
          ) : (
            recent.map((entry, index) => {
              const positive = entry.pointsDelta > 0;
              const isMoney = entry.pointsDelta === 0 && entry.creditDeltaCents !== 0;
              const icon = entry.type === 'redeem' ? 'gift' : entry.type === 'payout' ? 'send' : entry.type === 'bonus' ? 'award' : entry.type === 'referral' ? 'users' : entry.type === 'topup' ? 'credit-card' : 'refresh-cw';
              return (
                <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: index === recent.length - 1 ? 0 : 1, borderBottomColor: colors.line }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name={icon as any} size={15} color={colors.inkSoft} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text variant="small" style={{ fontWeight: '600' }} numberOfLines={1}>
                      {entry.description}
                    </Text>
                    <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                      {timeAgo(entry.createdAt, locale)}
                    </Text>
                  </View>
                  <Text variant="small" color={positive ? colors.success : isMoney ? colors.accent : colors.inkSoft} style={{ fontWeight: '700' }}>
                    {isMoney
                      ? `${entry.creditDeltaCents > 0 ? '+' : '-'}${formatBRL(Math.abs(entry.creditDeltaCents))}`
                      : `${entry.pointsDelta > 0 ? '+' : ''}${formatPoints(entry.pointsDelta)} pts`}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl, marginBottom: 8 }}>
        <ImpactRing progress={Math.min(1, data.stats.kgTotal / 150)} size={26} strokeWidth={3}>
          <View />
        </ImpactRing>
        <Text variant="caption" color={colors.muted} style={{ marginLeft: 8 }}>
          {t('home.streak', { weeks: data.stats.currentStreakWeeks })}
        </Text>
      </View>
    </Screen>
  );
}







