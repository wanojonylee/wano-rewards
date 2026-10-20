import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useT } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radii, spacing } from '../../src/theme/tokens';
import { useAuth } from '../../src/store/auth';
import { useConsent } from '../../src/lib/hooks';
import { useToast } from '../../src/components/Toast';

function CheckRow({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          borderWidth: 1.5,
          borderColor: checked ? colors.primary : colors.lineStrong,
          backgroundColor: checked ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          marginTop: 1,
        }}
      >
        {checked ? <Feather name="check" size={13} color={colors.primaryInk} /> : null}
      </View>
      <Text variant="small" color={colors.inkSoft} style={{ flex: 1, lineHeight: 20 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function Consent() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { show } = useToast();
  const completeOnboarding = useAuth((s) => s.completeOnboarding);
  const token = useAuth((s) => s.token);
  const consent = useConsent();
  const [lgpd, setLgpd] = useState(false);
  const [marketing, setMarketing] = useState(true);

  const onContinue = async () => {
    if (!lgpd) {
      show(t('onb.consent.required'), 'error');
      return;
    }
    if (token) {
      try {
        await consent.mutateAsync({ lgpd, marketing });
      } catch {
        // consent can be retried later; do not block navigation
      }
    }
    await completeOnboarding();
    router.replace(token ? '/home' : '/(auth)/sign-in');
  };

  return (
    <Screen scroll edges={['top', 'bottom']} bottomInset={32}>
      <ScreenHeader title={t('onb.consent.title')} subtitle={t('onb.slide3.body')} />

      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radii.lg,
          padding: spacing.lg,
          marginTop: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Feather name="shield" size={16} color={colors.primary} />
          </View>
          <Text variant="h3">{t('onb.slide3.eyebrow')}</Text>
        </View>
        <CheckRow checked={lgpd} onPress={() => setLgpd((v) => !v)} label={t('onb.consent.lgpd')} />
        <View style={{ height: spacing.md }} />
        <CheckRow checked={marketing} onPress={() => setMarketing((v) => !v)} label={t('onb.consent.marketing')} />
      </View>

      <Text variant="caption" color={colors.muted} style={{ marginTop: spacing.md, lineHeight: 18 }}>
        {t('onb.consent.legal')}
      </Text>

      <Button
        label={t('onb.start')}
        size="lg"
        fullWidth
        style={{ marginTop: spacing.xl }}
        onPress={onContinue}
        disabled={!lgpd}
        loading={consent.isPending}
        iconRight="arrow-right"
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: 18 }}>
        <Text variant="caption" color={colors.muted} onPress={() => router.push('/privacy')}>
          {t('settings.privacy')}
        </Text>
        <Text variant="caption" color={colors.muted} onPress={() => {}}>
          {t('settings.terms')}
        </Text>
      </View>
    </Screen>
  );
}

