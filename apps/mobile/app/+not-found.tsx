import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../src/components/Text';
import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { BrandMark } from '../src/components/Illustrations';
import { useT } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/tokens';

export default function NotFound() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <BrandMark size={52} />
        <Text variant="h1" style={{ marginTop: spacing.lg }}>
          404
        </Text>
        <Text variant="body" color={colors.muted} align="center" style={{ marginTop: 6, maxWidth: 260 }}>
          {t('notFound.body')}
        </Text>
        <Button label={t('notFound.home')} style={{ marginTop: spacing.xl }} onPress={() => router.replace('/home')} />
      </View>
    </Screen>
  );
}
