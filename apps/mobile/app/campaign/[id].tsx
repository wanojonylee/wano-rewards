import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { IconButton } from '../../src/components/Card';
import { ProgressBar, SectionHeader } from '../../src/components/Pill';
import { Avatar } from '../../src/components/Pill';
import { Skeleton } from '../../src/components/Skeleton';
import { useCampaign } from '../../src/lib/hooks';
import { useT, usePrefs } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing } from '../../src/theme/tokens';
import { formatDateFull, formatNumber } from '../../src/lib/format';
import { withAlpha } from '../../src/lib/color';
import { useToast } from '../../src/components/Toast';

export default function Campaign() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const locale = usePrefs((s) => s.locale);
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaign = useCampaign(id ?? '');
  const [joined, setJoined] = useState<boolean | null>(null);

  if (!campaign.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: insets.top + 16 }}>
        <Skeleton width="30%" height={20} />
        <Skeleton height={220} radius={20} style={{ marginTop: 20 }} />
        <Skeleton height={100} radius={16} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const data = campaign.data.campaign;
  const isJoined = joined ?? data.joined;
  const ratio = data.progress ? Math.min(1, data.progress.current / data.progress.target) : 0;
  const rules = [
    data.multiplier > 1
      ? t('campaign.ruleMultiplier', {
          multiplier: data.multiplier,
          target: data.material === 'MIXED' ? t('campaign.rulesAllMaterials') : data.material,
        })
      : t('campaign.ruleBonus', { points: data.bonusPoints }),
    t('campaign.ruleApproved'),
    t('campaign.ruleLiveRanking'),
    t('campaign.rulePrizes'),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
      <View style={{ backgroundColor: withAlpha(data.accent, 0.14), paddingTop: insets.top + 10, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <IconButton name="arrow-left" onPress={() => router.back()} background={withAlpha(colors.surface, 0.7)} bordered={false} />
          <IconButton name="share-2" onPress={() => show(t('common.soon'), 'info')} background={withAlpha(colors.surface, 0.7)} bordered={false} />
        </View>
        <Text variant="label" color={data.accent} style={{ marginTop: spacing.lg }}>
          {data.brand.toUpperCase()} · {t('campaign.label')}
        </Text>
        <Text variant="hero" style={{ marginTop: 8 }}>
          {data.title}
        </Text>
        <Text variant="body" color={colors.inkSoft} style={{ marginTop: 6 }}>
          {data.subtitle}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="zap" size={12} color={data.accent} />
            <Text variant="caption" style={{ marginLeft: 5, fontWeight: '700' }}>
              {data.multiplier > 1 ? t('campaign.multiplier', { multiplier: data.multiplier }) : t('campaign.bonus', { points: data.bonusPoints })}
            </Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text variant="caption" color={colors.inkSoft} style={{ fontWeight: '600' }}>
              {t('campaign.ends', { date: formatDateFull(data.endsAt, locale) })}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        {data.progress ? (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text variant="small" style={{ fontWeight: '700' }}>
                {t('campaign.progress')}
              </Text>
              <Text variant="small" color={colors.muted}>
                {formatNumber(data.progress.current)} / {formatNumber(data.progress.target)} {data.progress.unit}
              </Text>
            </View>
            <ProgressBar value={ratio} height={8} color={data.accent} />
            <Text variant="caption" color={colors.muted} style={{ marginTop: 8 }}>
              {t('campaign.goalPercent', { percent: Math.round(ratio * 100) })}
            </Text>
          </Card>
        ) : null}

        <Card tone="muted" style={{ marginTop: spacing.md }}>
          <Text variant="small" style={{ fontWeight: '700', marginBottom: 8 }}>
            {t('campaign.rules')}
          </Text>
          {rules.map((rule, index) => (
            <View key={index} style={{ flexDirection: 'row', marginTop: index === 0 ? 0 : 6 }}>
              <Text variant="caption" color={colors.muted} style={{ width: 16 }}>
                {index + 1}.
              </Text>
              <Text variant="caption" color={colors.muted} style={{ flex: 1, lineHeight: 18 }}>
                {rule}
              </Text>
            </View>
          ))}
        </Card>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title={t('campaign.leaderboard')} />
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {campaign.data.leaderboard.slice(0, 5).map((row, index) => (
              <View
                key={row.displayName}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: index === 4 ? 0 : 1, borderBottomColor: colors.line }}
              >
                <Text variant="small" color={index === 0 ? colors.gold : colors.muted} style={{ width: 22, fontWeight: '700' }}>
                  {index + 1}
                </Text>
                <Avatar name={row.displayName} size={32} color={row.avatarColor} />
                <Text variant="small" style={{ flex: 1, marginLeft: 10, fontWeight: row.isMe ? '700' : '500' }}>
                  {row.displayName}
                  {row.isMe ? t('campaign.you') : ''}
                </Text>
                <Text variant="small" color={colors.muted} style={{ fontWeight: '600' }}>
                  {formatNumber(row.value, 1)} {row.unit}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.md, paddingTop: spacing.sm }}>
        <Button
          label={isJoined ? t('campaign.joined') : t('campaign.join')}
          size="lg"
          fullWidth
          variant={isJoined ? 'secondary' : 'primary'}
          disabled={isJoined}
          icon={isJoined ? 'check' : 'plus'}
          onPress={() => {
            setJoined(true);
            show(t('campaign.joined'), 'success');
          }}
        />
      </View>
    </View>
  );
}





