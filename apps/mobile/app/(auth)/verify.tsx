import React, { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { useT, usePrefs } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radii, spacing } from '../../src/theme/tokens';
import { useAuth } from '../../src/store/auth';
import { useToast } from '../../src/components/Toast';
import { authApi, SHOW_DEMO_HINT } from '../../src/lib/api';

export default function Verify() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { show } = useToast();
  const locale = usePrefs((s) => s.locale);
  const verifyOtp = useAuth((s) => s.verifyOtp);
  const busy = useAuth((s) => s.busy);
  const params = useLocalSearchParams<{ identifier?: string; devCode?: string }>();
  const identifier = params.identifier ?? '';
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    const focus = setTimeout(() => inputRef.current?.focus(), 400);
    return () => {
      clearInterval(timer);
      clearTimeout(focus);
    };
  }, []);

  useEffect(() => {
    if (code.length === 6) submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const submit = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setError(null);
    try {
      await verifyOtp(identifier, value, locale);
      router.replace('/home');
    } catch (e: any) {
      setError(t('auth.invalidCode'));
      setCode('');
      show(t('auth.invalidCode'), 'error');
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    setSeconds(30);
    try {
      await authApi.requestOtp(identifier, identifier.includes('@') ? 'email' : 'sms');
      show(t('auth.resend'), 'success');
    } catch {
      show(t('common.error'), 'error');
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom']} bottomInset={32}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingTop: spacing.sm, width: 40 }}>
        <Feather name="arrow-left" size={22} color={colors.ink} />
      </Pressable>

      <Text variant="hero" style={{ marginTop: spacing.xxl }}>
        {t('auth.codeTitle')}
      </Text>
      <Text variant="body" color={colors.muted} style={{ marginTop: spacing.sm, lineHeight: 23 }}>
        {t('auth.codeBody', { identifier })}
      </Text>

      <Pressable onPress={() => inputRef.current?.focus()} style={{ marginTop: spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
          {Array.from({ length: 6 }).map((_, index) => {
            const char = code[index] ?? '';
            const active = code.length === index;
            return (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: 58,
                  borderRadius: radii.md,
                  borderWidth: 1.5,
                  borderColor: error ? colors.danger : char ? colors.primary : active ? colors.primary : colors.line,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="h2" style={{ fontSize: 22 }}>
                  {char}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(value) => {
            setError(null);
            setCode(value.replace(/\D/g, '').slice(0, 6));
          }}
          keyboardType="number-pad"
          maxLength={6}
          style={{ position: 'absolute', opacity: 0, height: 58, width: '100%' }}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
        />
      </Pressable>

      {error ? (
        <Text variant="caption" color={colors.danger} style={{ marginTop: 10 }}>
          {error}
        </Text>
      ) : null}

      <Button label={t('auth.verify')} size="lg" fullWidth style={{ marginTop: spacing.xl }} onPress={() => submit(code)} loading={busy} disabled={code.length !== 6} />

      <Text
        variant="small"
        align="center"
        color={seconds > 0 ? colors.muted : colors.primary}
        onPress={resend}
        style={{ marginTop: spacing.lg, fontWeight: seconds > 0 ? '500' : '700' }}
      >
        {seconds > 0 ? t('auth.resendIn', { seconds }) : t('auth.resend')}
      </Text>

      {SHOW_DEMO_HINT ? (
        <View style={{ marginTop: spacing.xl, padding: spacing.md, borderRadius: 14, backgroundColor: colors.primarySoft }}>
          <Text variant="caption" color={colors.primary} style={{ lineHeight: 17 }}>
            {t('auth.demoHint')}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}


