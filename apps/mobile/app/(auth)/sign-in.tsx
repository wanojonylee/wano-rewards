import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { BrandMark } from '../../src/components/Illustrations';
import { useT } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing } from '../../src/theme/tokens';
import { authApi, SHOW_DEMO_HINT } from '../../src/lib/api';
import { useToast } from '../../src/components/Toast';

export default function SignIn() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { show } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid = (value: string) => {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const phone = value.replace(/\D/g, '').length >= 10;
    return email || phone;
  };

  const onContinue = async () => {
    const value = identifier.trim();
    if (!isValid(value)) {
      setError(t('auth.invalidIdentifier'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.requestOtp(value, value.includes('@') ? 'email' : 'sms');
      router.push({
        pathname: '/(auth)/verify',
        params: { identifier: value, devCode: result.devCode ?? '' },
      });
    } catch (e) {
      show(e instanceof Error ? e.message : t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom']} bottomInset={32}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm }}>
        <BrandMark size={34} />
      </View>

      <Text variant="label" color={colors.muted} style={{ marginTop: spacing.xxl }}>
        {t('tabs.profile')}
      </Text>
      <Text variant="hero" style={{ marginTop: 8 }}>
        {t('auth.title')}
      </Text>
      <Text variant="body" color={colors.muted} style={{ marginTop: spacing.sm, lineHeight: 23 }}>
        {t('auth.subtitle')}
      </Text>

      <View style={{ marginTop: spacing.xl }}>
        <TextField
          label={t('auth.identifier')}
          placeholder={t('auth.identifierPlaceholder')}
          value={identifier}
          onChangeText={(v) => {
            setIdentifier(v);
            setError(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          icon="at-sign"
          error={error}
          onSubmitEditing={onContinue}
          returnKeyType="done"
        />
      </View>

      <Button
        label={t('common.continue')}
        size="lg"
        fullWidth
        style={{ marginTop: spacing.xl }}
        onPress={onContinue}
        loading={loading}
        iconRight="arrow-right"
      />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.lg }}>
        <Feather name="lock" size={13} color={colors.muted} style={{ marginTop: 2, marginRight: 6 }} />
        <Text variant="caption" color={colors.muted} style={{ flex: 1, lineHeight: 17 }}>
          {t('auth.terms')}
        </Text>
      </View>

      {SHOW_DEMO_HINT ? (
        <View style={{ marginTop: spacing.xl, padding: spacing.md, borderRadius: 14, backgroundColor: colors.primarySoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="terminal" size={14} color={colors.primary} />
            <Text variant="caption" color={colors.primary} style={{ marginLeft: 6, fontWeight: '700' }}>
              {t('common.demo')}
            </Text>
          </View>
          <Text variant="caption" color={colors.primary} style={{ marginTop: 4, lineHeight: 17 }}>
            {t('auth.demoHintFull')}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}


