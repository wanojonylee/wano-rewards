import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useT } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing } from '../../src/theme/tokens';

const stepIcons = ['camera', 'package', 'gift'] as const;

export default function HowItWorks() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const steps = stepIcons.map((icon, index) => ({
    icon,
    title: t(`onb.step${index + 1}.title`),
    body: t(`onb.step${index + 1}.body`),
  }));

  return (
    <Screen scroll edges={['top', 'bottom']} bottomInset={32}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm }}>
        <Feather name="arrow-left" size={22} color={colors.ink} onPress={() => router.back()} />
        <Text variant="caption" color={colors.muted} style={{ fontWeight: '600', letterSpacing: 1.2 }}>
          01 / 02
        </Text>
      </View>

      <Text variant="label" color={colors.muted} style={{ marginTop: spacing.xl }}>
        {t('onb.slide2.eyebrow')}
      </Text>
      <Text variant="hero" style={{ marginTop: 10 }}>
        {t('onb.slide2.title')}
      </Text>
      <Text variant="body" color={colors.muted} style={{ marginTop: spacing.sm }}>
        {t('onb.slide2.body')}
      </Text>

      <View style={{ marginTop: spacing.xl, gap: 12 }}>
        {steps.map((step, index) => (
          <View
            key={step.icon}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 18,
              padding: spacing.md,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name={step.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text variant="caption" color={colors.muted} style={{ fontWeight: '700', letterSpacing: 1 }}>
                {t('onb.step', { number: index + 1 })}
              </Text>
              <Text variant="h3" style={{ marginTop: 3 }}>
                {step.title}
              </Text>
              <Text variant="small" color={colors.muted} style={{ marginTop: 3, lineHeight: 19 }}>
                {step.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Card tone="muted" style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{t('onb.balances.title')}</Text>
          <Text variant="small" color={colors.muted} style={{ marginTop: 4, lineHeight: 19 }}>
            <Text variant="small" style={{ fontWeight: '700' }}>
              {t('onb.balances.pointsWord')}
            </Text>{' '}
            {t('onb.balances.pointsText')} {'\n'}
            <Text variant="small" style={{ fontWeight: '700' }}>
              {t('onb.balances.cashbackWord')}
            </Text>{' '}
            {t('onb.balances.cashbackText')}
          </Text>
        </View>
        <Feather name="layers" size={26} color={colors.primary} style={{ marginLeft: 8 }} />
      </Card>

      <Button
        label={t('onb.next')}
        size="lg"
        fullWidth
        style={{ marginTop: spacing.xl }}
        onPress={() => router.push('/(onboarding)/consent')}
        iconRight="arrow-right"
      />
    </Screen>
  );
}
