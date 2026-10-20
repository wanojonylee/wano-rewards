import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { TextField, Segmented } from '../src/components/TextField';
import { Sheet } from '../src/components/Sheet';
import { usePayout, useProfile } from '../src/lib/hooks';
import { useT } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/tokens';
import { formatBRL, maskPixKey } from '../src/lib/format';
import { useToast } from '../src/components/Toast';

export default function Payout() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { show } = useToast();
  const profile = useProfile();
  const payout = usePayout();
  const [amount, setAmount] = useState('20.00');
  const [pixType, setPixType] = useState('email');
  const [pixKey, setPixKey] = useState('marina@example.com');
  const [success, setSuccess] = useState<{ netCents: number; key: string } | null>(null);

  const withdrawable = profile.data?.wallet.withdrawableCents ?? 0;
  // Accept both "20.00" (the localized display format) and "20,00" (legacy input).
  const amountText = amount.trim();
  const normalizedAmount = amountText.includes(',')
    ? amountText.replace(/\./g, '').replace(',', '.')
    : amountText;
  const cents = Math.round(parseFloat(normalizedAmount) * 100) || 0;
  const valid = cents >= 2000 && cents <= withdrawable && pixKey.trim().length >= 5;

  const submit = async () => {
    if (!valid) {
      show(cents < 2000 ? t('wallet.min') : t('wallet.invalidAmount'), 'error');
      return;
    }
    try {
      const result = await payout.mutateAsync({
        amountCents: cents,
        pixKey: pixKey.trim(),
        pixKeyType: pixType,
        key: `payout-${Date.now()}`,
      });
      setSuccess({ netCents: result.payout.netCents, key: maskPixKey(result.payout.pixKeyMasked) });
    } catch (e: any) {
      show(e?.message ?? t('common.error'), 'error');
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t('wallet.withdrawTitle')} subtitle={t('wallet.withdrawBody')} />

      <Card tone="muted">
        <Text variant="caption" color={colors.muted}>
          {t('wallet.withdrawable')}
        </Text>
        <Text variant="hero" style={{ marginTop: 4 }}>
          {formatBRL(withdrawable)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <Feather name="info" size={12} color={colors.muted} />
          <Text variant="caption" color={colors.muted} style={{ marginLeft: 5 }}>
            {t('wallet.min')} · {t('wallet.max')}
          </Text>
        </View>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <TextField
          label={t('wallet.amount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="30.00"
          icon="dollar-sign"
          error={amount.length > 0 && cents < 2000 ? t('wallet.min') : null}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
          {['20.00', '50.00', '100.00'].map((value) => (
            <Text
              key={value}
              variant="caption"
              onPress={() => setAmount(value)}
              style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, overflow: 'hidden', fontWeight: '600' }}
            >
              R$ {value}
            </Text>
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text variant="caption" color={colors.muted} style={{ marginBottom: 8, fontWeight: '600' }}>
          {t('wallet.pixType')}
        </Text>
        <Segmented
          value={pixType}
          onChange={setPixType}
          options={[
            { value: 'email', label: t('payout.pixEmail') },
            { value: 'cpf', label: 'CPF' },
            { value: 'phone', label: t('payout.pixPhone') },
            { value: 'random', label: t('payout.pixRandom') },
          ]}
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <TextField
          label={t('wallet.pixKey')}
          value={pixKey}
          onChangeText={setPixKey}
          placeholder={t('payout.pixKeyPlaceholder')}
          autoCapitalize="none"
          icon="key"
        />
      </View>

      <Card tone="muted" style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Feather name="clock" size={14} color={colors.inkSoft} />
          <Text variant="small" style={{ marginLeft: 6, fontWeight: '700' }}>
            {t('payout.termsTitle')}
          </Text>
        </View>
        <Text variant="caption" color={colors.muted} style={{ lineHeight: 18 }}>
          {t('payout.termsBody')}
        </Text>
      </Card>

      <Button label={t('wallet.request')} size="lg" fullWidth style={{ marginTop: spacing.xl }} onPress={submit} loading={payout.isPending} disabled={!valid} icon="send" />

      <Sheet visible={!!success} onClose={() => { setSuccess(null); router.back(); }} title={t('wallet.withdrawRequested')}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="check" size={28} color={colors.primary} />
          </View>
          <Text variant="body" color={colors.muted} align="center" style={{ marginTop: spacing.md }}>
            {t('wallet.withdrawRequestedBody')}
          </Text>
          {success ? (
            <View style={{ marginTop: spacing.sm, alignItems: 'center' }}>
              <Text variant="h2">{formatBRL(success.netCents)}</Text>
              <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                {t('payout.to', { key: success.key })}
              </Text>
            </View>
          ) : null}
          <Button label={t('common.continue')} fullWidth style={{ marginTop: spacing.lg }} onPress={() => { setSuccess(null); router.back(); }} />
        </View>
      </Sheet>
    </Screen>
  );
}

