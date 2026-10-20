import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { layout } from '../theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  refreshing?: boolean;
  onRefresh?: () => void;
  bottomInset?: number;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  style,
  contentStyle,
  edges = ['top'],
  refreshing,
  onRefresh,
  bottomInset = 120,
}: ScreenProps) {
  const { colors } = useTheme();
  const padding = padded ? { paddingHorizontal: layout.screenPadding } : null;

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[padding, { paddingBottom: bottomInset }, contentStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export const screenStyles = StyleSheet.create({});
