import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as any)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="rewards" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="impact" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
