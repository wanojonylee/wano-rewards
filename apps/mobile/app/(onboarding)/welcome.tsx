import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { BrandMark, RvmIllustration } from '../../src/components/Illustrations';
import { useT } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing } from '../../src/theme/tokens';
import { useAuth } from '../../src/store/auth';

export default function Welcome() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const completeOnboarding = useAuth((s) => s.completeOnboarding);

  const goSignIn = async () => {
    await completeOnboarding();
    router.push('/(auth)/sign-in');
  };

  return (
    <Screen scroll edges={['top', 'bottom']} bottomInset={32}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm }}>
        <BrandMark size={34} />
        <Text variant="caption" color={colors.muted} style={{ marginLeft: 8, letterSpacing: 1.2, fontWeight: '700', marginTop: 3 }}>
          REWARDS
        </Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
        <RvmIllustration width={248} height={286} />
      </View>

      <Text variant="label" color={colors.muted} style={{ marginTop: spacing.xl }}>
        {t('onb.slide1.eyebrow')}
      </Text>
      <Text variant="display" style={{ marginTop: 10 }}>
        {t('onb.slide1.title')}
      </Text>
      <Text variant="body" color={colors.muted} style={{ marginTop: spacing.md, maxWidth: 330, lineHeight: 23 }}>
        {t('onb.slide1.body')}
      </Text>

      <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.xl }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: i === 0 ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === 0 ? colors.primary : colors.lineStrong,
            }}
          />
        ))}
      </View>

      <View style={{ marginTop: spacing.xl, gap: 12 }}>
        <Button label={t('onb.next')} size="lg" fullWidth onPress={() => router.push('/(onboarding)/how-it-works')} iconRight="arrow-right" />
        <Text variant="small" color={colors.muted} align="center" onPress={goSignIn} style={{ paddingVertical: 6 }}>
          {t('auth.title')}
        </Text>
      </View>
    </Screen>
  );
}

