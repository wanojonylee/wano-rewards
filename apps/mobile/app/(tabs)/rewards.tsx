import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Pill } from '../../src/components/Pill';
import { RewardTile } from '../../src/components/RewardTile';
import { Skeleton } from '../../src/components/Skeleton';
import { useProfile, useRewards } from '../../src/lib/hooks';
import { useT } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing } from '../../src/theme/tokens';
import { formatPoints } from '../../src/lib/format';
import type { Reward } from '../../src/types';

const categories = [
  { value: 'all', key: 'rewards.all' },
  { value: 'voucher', key: 'rewards.voucher' },
  { value: 'product', key: 'rewards.product' },
  { value: 'experience', key: 'rewards.experience' },
  { value: 'donation', key: 'rewards.donation' },
];

export default function Rewards() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const profile = useProfile();
  const rewards = useRewards(category, search);
  const points = profile.data?.wallet.points ?? 0;

  const data = rewards.data?.items ?? [];
  const featured = useMemo(() => data.filter((r) => r.highlight).slice(0, 3), [data]);

  const renderItem = ({ item }: { item: Reward }) => (
    <View style={{ width: '48.5%', marginBottom: spacing.lg }}>
      <RewardTile reward={item} balance={points} onPress={() => router.push(`/reward/${item.id}`)} width="100%" />
    </View>
  );

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshing={rewards.isRefetching}
        onRefresh={() => rewards.refetch()}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <Text variant="label" color={colors.muted}>
                  {t('rewards.eyebrow')}
                </Text>
                <Text variant="h1" style={{ marginTop: 6 }}>
                  {t('rewards.title')}
                </Text>
              </View>
              <Pressable onPress={() => router.push('/wallet')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, marginRight: 6 }} />
                <Text variant="small" style={{ fontWeight: '700' }}>
                  {formatPoints(points)}
                </Text>
              </Pressable>
            </View>
            <Text variant="body" color={colors.muted} style={{ marginTop: 4 }}>
              {t('rewards.subtitle', { points: formatPoints(points) })}
            </Text>

            <View style={{ marginTop: spacing.lg }}>
              <TextField
                value={search}
                onChangeText={setSearch}
                placeholder={t('rewards.searchPlaceholder')}
                icon="search"
                returnKeyType="search"
              />
            </View>

            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item.value}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: spacing.md }}
              renderItem={({ item }) => (
                <Pill label={t(item.key)} active={category === item.value} onPress={() => setCategory(item.value)} tone="outline" />
              )}
            />

            {category === 'all' && !search && featured.length > 0 ? (
              <View style={{ marginBottom: spacing.md }}>
                <Text variant="h3" style={{ marginBottom: spacing.sm }}>
                  {t('rewards.featured')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {featured.map((reward) => (
                    <Pressable
                      key={reward.id}
                      onPress={() => router.push(`/reward/${reward.id}`)}
                      style={{ flex: 1, backgroundColor: colors.primarySoft, borderRadius: 14, padding: 12, minHeight: 92, justifyContent: 'space-between' }}
                    >
                      <Feather name="star" size={14} color={colors.primary} />
                      <View>
                        <Text variant="caption" numberOfLines={2} style={{ fontWeight: '700', lineHeight: 17 }}>
                          {reward.title}
                        </Text>
                        <Text variant="caption" color={colors.primary} style={{ marginTop: 3, fontWeight: '700' }}>
                          {formatPoints(reward.pointsCost)} pts
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          rewards.isLoading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: spacing.md }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ width: '48.5%', marginBottom: spacing.lg }}>
                  <Skeleton height={124} radius={14} />
                  <Skeleton width="80%" height={14} style={{ marginTop: 10 }} />
                  <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
              <Feather name="search" size={26} color={colors.muted} />
              <Text variant="h3" style={{ marginTop: 12 }}>
                {t('rewards.empty')}
              </Text>
              <Text variant="small" color={colors.muted} style={{ marginTop: 4 }}>
                {t('rewards.emptyBody')}
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}
