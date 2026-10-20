import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Share } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { SectionHeader } from '../../src/components/Pill';
import { ScreenSkeleton } from '../../src/components/Skeleton';
import { ImpactRing } from '../../src/components/Illustrations';
import { useImpact } from '../../src/lib/hooks';
import { useT } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, radii } from '../../src/theme/tokens';
import { formatNumber } from '../../src/lib/format';
import { materialColors } from '../../src/theme/colors';
import { withAlpha } from '../../src/lib/color';
import { useToast } from '../../src/components/Toast';

export default function Impact() {
  const t = useT();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { show } = useToast();
  const impact = useImpact();

  if (!impact.data) return <ScreenSkeleton />;
  const data = impact.data;
  const maxKg = Math.max(...data.months.map((m) => m.kg), 1);
  const totalMaterial = data.materials.reduce((sum, m) => sum + m.kg, 0);
  const trees = Math.max(1, Math.round(data.totals.co2Kg / 21));

  const share = async () => {
    try {
      await Share.share({
        message: t('impact.shareMessage', {
          kg: formatNumber(data.totals.kg, 1),
          co2: formatNumber(data.totals.co2Kg, 1),
        }),
      });
    } catch {
      show(t('common.soon'), 'info');
    }
  };

  return (
    <Screen scroll edges={['top']} bottomInset={100}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: spacing.sm }}>
        <View>
          <Text variant="label" color={colors.muted}>
            {t('impact.eyebrow')}
          </Text>
          <Text variant="h1" style={{ marginTop: 6 }}>
            {t('impact.title')}
          </Text>
          <Text variant="body" color={colors.muted} style={{ marginTop: 4 }}>
            {t('impact.subtitle')}
          </Text>
        </View>
        <Pressable onPress={share} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="share-2" size={17} color={colors.ink} />
        </Pressable>
      </View>

      <Card style={{ marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.xl }}>
        <ImpactRing progress={Math.min(1, data.totals.kg / 50)} size={168} strokeWidth={10}>
          <Text variant="display" style={{ fontSize: 44, lineHeight: 46 }}>
            {formatNumber(data.totals.kg, 1)}
          </Text>
          <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
            {t('impact.kg')}
          </Text>
        </ImpactRing>
        <View style={{ flexDirection: 'row', marginTop: spacing.lg, width: '100%', justifyContent: 'space-around' }}>
          {[
            { label: t('impact.co2'), value: formatNumber(data.totals.co2Kg, 1), unit: 'kg' },
            { label: t('impact.items'), value: formatNumber(data.totals.items), unit: '' },
            { label: t('impact.sessions'), value: formatNumber(data.totals.sessions), unit: '' },
          ].map((stat, index) => (
            <View key={stat.label} style={{ alignItems: 'center', borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: colors.line, flex: 1 }}>
              <Text variant="h2">{stat.value}</Text>
              <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="caption" color={colors.muted} align="center" style={{ marginTop: spacing.md, lineHeight: 17 }}>
          {t('impact.equivalent', { trees })}
        </Text>
      </Card>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title={t('impact.month')} />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150 }}>
            {data.months.map((month) => {
              const height = Math.max(6, (month.kg / maxKg) * 110);
              return (
                <View key={month.label} style={{ alignItems: 'center', flex: 1 }}>
                  <Text variant="caption" color={colors.muted} style={{ marginBottom: 6, fontWeight: '600' }}>
                    {month.kg}
                  </Text>
                  <View style={{ width: 22, height, borderRadius: 6, backgroundColor: withAlpha(colors.primary, isDark ? 0.85 : 0.9) }} />
                  <Text variant="caption" color={colors.muted} style={{ marginTop: 6 }}>
                    {month.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title={t('impact.byMaterial')} />
        <Card>
          {data.materials.map((material, index) => {
            const pct = totalMaterial > 0 ? material.kg / totalMaterial : 0;
            const color = materialColors[material.material] ?? colors.primary;
            return (
              <View key={material.material} style={{ marginTop: index === 0 ? 0 : spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text variant="small" style={{ fontWeight: '600' }}>
                    {material.material}
                  </Text>
                  <Text variant="caption" color={colors.muted}>
                    {formatNumber(material.kg, 1)} kg · {Math.round(pct * 100)}%
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
                  <View style={{ width: `${pct * 100}%`, height: 6, borderRadius: 3, backgroundColor: color }} />
                </View>
              </View>
            );
          })}
        </Card>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title={t('impact.badges')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {data.badges.map((badge) => (
            <View
              key={badge.id}
              style={{
                width: '48.5%',
                marginBottom: 12,
                borderRadius: radii.md,
                padding: spacing.md,
                backgroundColor: badge.unlocked ? colors.surface : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: badge.unlocked ? colors.line : 'transparent',
                opacity: badge.unlocked ? 1 : 0.75,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: badge.unlocked ? colors.primarySoft : colors.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={badge.unlocked ? 'award' : 'lock'} size={15} color={badge.unlocked ? colors.primary : colors.muted} />
                </View>
                {badge.unlocked ? <Feather name="check-circle" size={14} color={colors.success} /> : null}
              </View>
              <Text variant="small" style={{ fontWeight: '700', marginTop: 10 }}>
                {badge.title}
              </Text>
              <Text variant="caption" color={colors.muted} numberOfLines={2} style={{ marginTop: 3, lineHeight: 16 }}>
                {badge.description}
              </Text>
              {!badge.unlocked && badge.progress ? (
                <Text variant="caption" color={colors.muted} style={{ marginTop: 6 }}>
                  {badge.progress.current}/{badge.progress.target}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      <Pressable onPress={() => router.push('/leaderboard')} style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
          {t('leader.condo')} · {t('home.ranking')}
        </Text>
        <Feather name="arrow-right" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
      </Pressable>
    </Screen>
  );
}
