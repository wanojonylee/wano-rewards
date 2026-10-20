import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { useT } from '../store/prefs';
import { spacing } from '../theme/tokens';
import { IconButton } from './Card';
import { Text } from './Text';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  onBack?: () => void;
}

export function ScreenHeader({ title, subtitle, back = true, right, onBack }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {back ? (
          <IconButton name="arrow-left" accessibilityLabel={t('common.back')} onPress={onBack ?? (() => router.back())} background={colors.surface} />
        ) : (
          <View style={{ width: 40 }} />
        )}
        {right ? <View>{right}</View> : <View style={{ width: 40 }} />}
      </View>
      <Text variant="h1" style={{ marginTop: spacing.lg }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color={colors.muted} style={{ marginTop: 6 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
      {icon ?? null}
      <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>
        {title}
      </Text>
      {body ? (
        <Text variant="small" color={colors.muted} align="center" style={{ marginTop: 6, maxWidth: 280 }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
