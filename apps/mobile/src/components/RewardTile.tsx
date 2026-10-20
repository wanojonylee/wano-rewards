import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';
import { useT } from '../store/prefs';
import { radii, spacing } from '../theme/tokens';
import { withAlpha } from '../lib/color';
import { rewardAccents } from '../theme/colors';
import { formatPoints } from '../lib/format';
import { Text } from './Text';
import type { Reward } from '../types';

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

interface RewardTileProps {
  reward: Reward;
  onPress?: () => void;
  balance?: number;
  width?: number | `${number}%`;
}

export function RewardTile({ reward, onPress, balance, width = '48%' }: RewardTileProps) {
  const { colors } = useTheme();
  const t = useT();
  const accent = rewardAccents[reward.imageKey] ?? { bg: colors.primarySoft, fg: colors.primary };
  const affordable = balance === undefined || balance >= reward.pointsCost;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width, opacity: pressed ? 0.85 : 1 })} accessibilityRole="button">
      <View
        style={{
          height: 124,
          borderRadius: radii.md,
          backgroundColor: accent.bg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', right: -18, top: -18, width: 76, height: 76, borderRadius: 38, backgroundColor: withAlpha(accent.fg, 0.08) }} />
        <Feather name={iconFor[reward.imageKey] ?? 'gift'} size={34} color={accent.fg} />
        {reward.isNew ? (
          <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text variant="caption" color={colors.ink} style={{ fontSize: 10, fontWeight: '700' }}>
              {t('rewards.new')}
            </Text>
          </View>
        ) : null}
        {!affordable ? (
          <View style={{ position: 'absolute', right: 8, top: 8, backgroundColor: withAlpha('#14160F', 0.42), borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Feather name="lock" size={10} color="#FFF" />
          </View>
        ) : null}
      </View>
      <Text variant="small" numberOfLines={2} style={{ marginTop: 9, fontWeight: '700', lineHeight: 18 }}>
        {reward.title}
      </Text>
      <Text variant="caption" color={colors.muted} numberOfLines={1} style={{ marginTop: 2 }}>
        {reward.partner}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginRight: 5 }} />
        <Text variant="caption" color={affordable ? colors.ink : colors.muted} style={{ fontWeight: '700' }}>
          {formatPoints(reward.pointsCost)} pts
        </Text>
      </View>
    </Pressable>
  );
}

interface CampaignCardProps {
  title: string;
  subtitle: string;
  brand: string;
  accent: string;
  multiplier: number;
  bonusPoints: number;
  progress?: { current: number; target: number; unit: string } | null;
  joined?: boolean;
  onPress?: () => void;
  width?: number;
}

export function CampaignCard({ title, subtitle, brand, accent, multiplier, bonusPoints, progress, joined, onPress, width = 264 }: CampaignCardProps) {
  const { colors } = useTheme();
  const t = useT();
  const ratio = progress ? Math.min(1, progress.current / progress.target) : 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width, opacity: pressed ? 0.9 : 1 })}>
      <View
        style={{
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          padding: spacing.lg,
          height: 196,
          justifyContent: 'space-between',
        }}
      >
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: withAlpha(accent, 0.16), alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <Feather name="award" size={15} color={accent} />
              </View>
              <Text variant="caption" color={colors.muted} style={{ fontWeight: '700', letterSpacing: 0.6 }}>
                {brand.toUpperCase()}
              </Text>
            </View>
            {joined ? (
              <View style={{ backgroundColor: colors.primarySoft, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text variant="caption" color={colors.primary} style={{ fontSize: 10, fontWeight: '700' }}>
                  {t('campaign.active')}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="h3" numberOfLines={2} style={{ marginTop: 12 }}>
            {title}
          </Text>
          <Text variant="caption" color={colors.muted} numberOfLines={2} style={{ marginTop: 4 }}>
            {subtitle}
          </Text>
        </View>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ backgroundColor: withAlpha(accent, 0.14), borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 }}>
              <Text variant="caption" color={accent} style={{ fontWeight: '700', fontSize: 10 }}>
                {multiplier > 1 ? t('campaign.multiplierShort', { multiplier }) : t('campaign.bonusShort', { points: bonusPoints })}
              </Text>
            </View>
            {progress ? (
              <Text variant="caption" color={colors.muted}>
                {progress.current} / {progress.target} {progress.unit}
              </Text>
            ) : null}
          </View>
          {progress ? (
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
              <View style={{ width: `${ratio * 100}%`, height: 4, backgroundColor: accent }} />
            </View>
          ) : (
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted }} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const tileStyles = StyleSheet.create({});


