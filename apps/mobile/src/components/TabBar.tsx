import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { shadows, spacing } from '../theme/tokens';
import { useT } from '../store/prefs';
import { Text } from './Text';

interface TabBarProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { emit: (event: { type: string; target?: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean }; navigate: (name: string) => void };
}

const items: Array<{ route: string; icon: React.ComponentProps<typeof Feather>['name']; labelKey: string }> = [
  { route: 'home', icon: 'home', labelKey: 'tabs.home' },
  { route: 'rewards', icon: 'gift', labelKey: 'tabs.rewards' },
  { route: 'scan', icon: 'camera', labelKey: 'tabs.scan' },
  { route: 'impact', icon: 'bar-chart-2', labelKey: 'tabs.impact' },
  { route: 'profile', icon: 'user', labelKey: 'tabs.profile' },
];

export function TabBar({ state, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  const renderItem = (item: (typeof items)[number], index: number) => {
    const route = state.routes.find((r) => r.name === item.route);
    const focused = state.routes[state.index]?.name === item.route;
    const isCenter = item.route === 'scan';

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route?.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(item.route);
    };

    if (isCenter) {
      return (
        <Pressable key={item.route} onPress={onPress} accessibilityRole="button" accessibilityLabel={t(item.labelKey)} style={styles.centerWrap}>
          <View
            style={[
              styles.center,
              {
                backgroundColor: colors.primary,
                borderColor: colors.bg,
                shadowColor: colors.primary,
              },
              shadows.floating,
            ]}
          >
            <Feather name={item.icon} size={22} color={colors.primaryInk} />
          </View>
          <Text variant="caption" color={focused ? colors.primary : colors.muted} style={{ fontSize: 10, marginTop: 4, fontWeight: '600' }}>
            {t(item.labelKey)}
          </Text>
        </Pressable>
      );
    }

    return (
      <Pressable key={item.route} onPress={onPress} accessibilityRole="button" accessibilityLabel={t(item.labelKey)} style={styles.item}>
        <Feather name={item.icon} size={21} color={focused ? colors.ink : colors.muted} />
        <Text variant="caption" color={focused ? colors.ink : colors.muted} style={{ fontSize: 10, marginTop: 3, fontWeight: focused ? '700' : '500' }}>
          {t(item.labelKey)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {items.map(renderItem)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -22,
  },
  center: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
});

