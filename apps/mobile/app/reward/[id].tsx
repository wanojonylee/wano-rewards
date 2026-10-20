import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radii, spacing } from '../../src/theme/tokens';
import { Text } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { Card, IconButton } from '../../src/components/Card';
import { Sheet } from '../../src/components/Sheet';
import { QRCodeView } from '../../src/components/QRCodeView';
import { Skeleton } from '../../src/components/Skeleton';
import { withAlpha } from '../../src/lib/color';
import { rewardAccents } from '../../src/theme/colors';
import { formatBRL, formatDateFull, formatPoints } from '../../src/lib/format';
import { useRedeemReward, useReward, useProfile } from '../../src/lib/hooks';
import { useT, usePrefs } from '../../src/store/prefs';
import { useToast } from '../../src/components/Toast';
import type { Redemption } from '../../src/types';

const iconFor: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  coffee: 'coffee',
  market: 'shopping-bag',
  cinema: 'film',
  transit: 'navigation',
  gym: 'activity',
  donation: 'heart',
  bottle: 'droplet',
  bag: 'briefcase',
  plant: 'feather',
  ticket: 'tag',
  icecream: 'sun',
  bookstore: 'book-open',
  streaming: 'play',
  bike: 'navigation',
};

export default function RewardDetail() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const locale = usePrefs((s) => s.locale);
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useReward(id ?? '');
  const profile = useProfile();
  const redeem = useRedeemReward();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<Redemption | null>(null);

  const reward = detail.data?.reward;
  const points = profile.data?.wallet.points ?? 0;

  if (!reward) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: insets.top + 12 }}>
        <IconButton name="arrow-left" onPress={() => router.back()} />
        <Skeleton height={240} radius={20} style={{ marginTop: spacing.lg }} />
        <Skeleton width="70%" height={28} style={{ marginTop: spacing.lg }} />
        <Skeleton width="45%" height={16} style={{ marginTop: 10 }} />
        <Skeleton height={100} radius={16} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const accent = rewardAccents[reward.imageKey] ?? { bg: colors.primarySoft, fg: colors.primary };
  const affordable = points >= reward.pointsCost;
  const missing = reward.pointsCost - points;

  const onConfirm = async () => {
    try {
      const response = await redeem.mutateAsync({ id: reward.id, key: `${reward.id}-${Date.now()}-${Math.random().toString(16).slice(2)}` });
      setConfirmOpen(false);
      setResult(response.redemption);
    } catch (e: any) {
      setConfirmOpen(false);
      const code = e?.code ?? '';
      if (code === 'INSUFFICIENT_POINTS') show(t('reward.insufficient', { points: formatPoints(missing) }), 'error');
      else show(t('common.error'), 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ height: 290, backgroundColor: accent.bg, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: insets.top + 10, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton name="arrow-left" onPress={() => router.back()} background={withAlpha('#FFFFFF', 0.55)} bordered={false} />
            <IconButton name="share-2" onPress={() => show(t('common.soon'), 'info')} background={withAlpha('#FFFFFF', 0.55)} bordered={false} />
          </View>
          <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: withAlpha(accent.fg, 0.06) }} />
          <View style={{ position: 'absolute', width: 340, height: 340, borderRadius: 170, borderWidth: 1, borderColor: withAlpha(accent.fg, 0.12) }} />
          <Feather name={iconFor[reward.imageKey] ?? 'gift'} size={78} color={accent.fg} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: colors.surfaceMuted, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
              <Text variant="caption" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
                {t(`rewards.${reward.category}` as any)}
              </Text>
            </View>
            {reward.stockLabel ? (
              <View style={{ backgroundColor: colors.accentSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
                <Text variant="caption" color={colors.accent} style={{ fontWeight: '700' }}>
                  {reward.stockLabel}
                </Text>
              </View>
            ) : null}
          </View>

          <Text variant="h1" style={{ marginTop: spacing.sm }}>
            {reward.title}
          </Text>
          <Text variant="body" color={colors.muted} style={{ marginTop: 4 }}>
            {reward.subtitle}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: 16 }}>
            <View>
              <Text variant="caption" color={colors.muted}>
                {t('reward.partner')}
              </Text>
              <Text variant="small" style={{ fontWeight: '700', marginTop: 2 }}>
                {reward.partner}
              </Text>
            </View>
            <View style={{ width: 1, height: 28, backgroundColor: colors.line }} />
            <View>
              <Text variant="caption" color={colors.muted}>
                {t('reward.value')}
              </Text>
              <Text variant="small" style={{ fontWeight: '700', marginTop: 2 }}>
                {formatBRL(reward.valueCents)}
              </Text>
            </View>
            <View style={{ width: 1, height: 28, backgroundColor: colors.line }} />
            <View>
              <Text variant="caption" color={colors.muted}>
                {t('reward.stock')}
              </Text>
              <Text variant="small" style={{ fontWeight: '700', marginTop: 2 }}>
                {reward.stock}
              </Text>
            </View>
          </View>

          <Card tone="muted" style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Feather name="info" size={14} color={colors.inkSoft} />
              <Text variant="small" style={{ marginLeft: 6, fontWeight: '700' }}>
                {t('reward.terms')}
              </Text>
            </View>
            <Text variant="small" color={colors.muted} style={{ lineHeight: 20 }}>
              {reward.terms}
            </Text>
            {reward.expiresAt ? (
              <Text variant="caption" color={colors.muted} style={{ marginTop: 8 }}>
                {t('orders.validUntil', { date: formatDateFull(reward.expiresAt, locale) })}
              </Text>
            ) : null}
          </Card>

          {detail.data?.related && detail.data.related.length > 0 ? (
            <View style={{ marginTop: spacing.xl }}>
              <Text variant="h3" style={{ marginBottom: spacing.sm }}>
                {t('reward.related')}
              </Text>
              {detail.data.related.map((related) => (
                <Pressable key={related.id} onPress={() => router.push(`/reward/${related.id}`)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: (rewardAccents[related.imageKey] ?? { bg: colors.surfaceMuted }).bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name={iconFor[related.imageKey] ?? 'gift'} size={18} color={(rewardAccents[related.imageKey] ?? { fg: colors.ink }).fg} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text variant="small" style={{ fontWeight: '600' }}>
                      {related.title}
                    </Text>
                    <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                      {formatPoints(related.pointsCost)} pts
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.lineStrong} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* bottom bar */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View>
          <Text variant="caption" color={colors.muted}>
            {t('home.balance')}
          </Text>
          <Text variant="h3">{formatPoints(points)} pts</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={affordable ? t('reward.redeem', { points: formatPoints(reward.pointsCost) }) : t('reward.missing', { points: formatPoints(missing) })}
            onPress={() => setConfirmOpen(true)}
            disabled={!affordable}
            loading={redeem.isPending}
            fullWidth
          />
        </View>
      </View>

      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('reward.confirmTitle')}>
        <Text variant="body" color={colors.muted} style={{ lineHeight: 22 }}>
          {t('reward.confirmBody', { points: formatPoints(reward.pointsCost) })}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line }}>
          <View>
            <Text variant="caption" color={colors.muted}>
              {t('reward.after', { points: formatPoints(points - reward.pointsCost) })}
            </Text>
            <Text variant="h3" style={{ marginTop: 3 }}>
              {reward.title}
            </Text>
          </View>
          <Text variant="h3" color={colors.accent}>
            -{formatPoints(reward.pointsCost)}
          </Text>
        </View>
        <Button label={t('common.confirm')} fullWidth size="lg" style={{ marginTop: spacing.lg }} onPress={onConfirm} loading={redeem.isPending} />
        <Button label={t('common.cancel')} variant="ghost" fullWidth style={{ marginTop: 6 }} onPress={() => setConfirmOpen(false)} />
      </Sheet>

      <Sheet visible={!!result} onClose={() => { setResult(null); router.replace('/orders'); }} title={t('reward.confirmed')}>
        {result ? (
          <View>
            <QRCodeView value={result.qrPayload} size={168} />
            <Text variant="mono" align="center" style={{ marginTop: spacing.md }}>
              {result.code}
            </Text>
            <Text variant="caption" color={colors.muted} align="center" style={{ marginTop: 6 }}>
              {t('orders.validUntil', { date: formatDateFull(result.expiresAt, locale) })}
            </Text>
            <Button label={t('common.continue')} fullWidth style={{ marginTop: spacing.lg }} onPress={() => { setResult(null); router.replace('/orders'); }} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}


