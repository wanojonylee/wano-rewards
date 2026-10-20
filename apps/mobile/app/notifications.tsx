import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { EmptyState } from '../src/components/ScreenHeader';
import { useReadAllNotifications, useNotifications } from '../src/lib/hooks';
import { useT, usePrefs } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/tokens';
import { timeAgo } from '../src/lib/format';
import { notificationApi } from '../src/lib/api';
import { useQueryClient } from '@tanstack/react-query';

const iconFor: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  reward: 'gift',
  campaign: 'award',
  machine: 'cpu',
  payout: 'send',
  system: 'info',
};

export default function Notifications() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const locale = usePrefs((s) => s.locale);
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const readAll = useReadAllNotifications();

  const items = notifications.data?.items ?? [];

  const open = async (id: string, deepLink: string | null) => {
    try {
      await notificationApi.read(id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      // ignore
    }
    if (deepLink) router.push(deepLink as any);
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('notif.title')}
        right={
          items.length > 0 ? (
            <Pressable onPress={() => readAll.mutate()} hitSlop={8}>
              <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
                {t('notif.markAll')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={<Feather name="bell-off" size={26} color={colors.muted} />} title={t('notif.empty')} />
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((item) => (
            <Card key={item.id} onPress={() => open(item.id, item.deepLink)}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={iconFor[item.kind] ?? 'bell'} size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text variant="small" style={{ fontWeight: item.read ? '600' : '800', flex: 1 }}>
                      {item.title}
                    </Text>
                    {!item.read ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, marginLeft: 6 }} /> : null}
                  </View>
                  <Text variant="caption" color={colors.muted} style={{ marginTop: 3, lineHeight: 17 }}>
                    {item.body}
                  </Text>
                  <Text variant="caption" color={colors.muted} style={{ marginTop: 5, opacity: 0.8 }}>
                    {timeAgo(item.createdAt, locale)}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
