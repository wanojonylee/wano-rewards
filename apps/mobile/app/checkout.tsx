import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Sheet } from '../src/components/Sheet';
import { useMockComplete, useCheckout, usePacks } from '../src/lib/hooks';
import { IS_DEMO } from '../src/lib/api';
import { useT } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { radii, spacing } from '../src/theme/tokens';
import { formatBRL, formatPoints } from '../src/lib/format';
import { useToast } from '../src/components/Toast';
import type { Pack } from '../src/types';

export default function Checkout() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { show } = useToast();
  const packs = usePacks();
  const checkout = useCheckout();
  const mockComplete = useMockComplete();
  const [selected, setSelected] = useState<string>('pack-50');
  const [method, setMethod] = useState<'card' | 'pix'>('card');
  const [pending, setPending] = useState<{ id: string; amountCents: number; bonusPoints: number; packId: string } | null>(null);
  const [success, setSuccess] = useState<{ creditCents: number; bonusPoints: number } | null>(null);

  const items = packs.data?.items ?? [];
  const pack = items.find((p) => p.id === selected) ?? items[1] ?? items[0];

  const pay = async () => {
    if (!pack) return;
    try {
      const result = await checkout.mutateAsync({
        packId: pack.id,
        successUrl: 'recio://wallet?status=success',
        cancelUrl: 'recio://wallet?status=cancel',
        key: `${pack.id}-${Date.now()}`,
      });
      if (result.payment.provider === 'mock' || IS_DEMO) {
        setPending({ id: result.payment.id, amountCents: result.payment.amountCents, bonusPoints: result.payment.bonusPoints, packId: pack.id });
      } else if (result.payment.checkoutUrl) {
        await WebBrowser.openBrowserAsync(result.payment.checkoutUrl);
        router.replace('/wallet');
      }
    } catch {
      show(t('common.error'), 'error');
    }
  };

  const completeMock = async () => {
    if (!pending) return;
    try {
      await mockComplete.mutateAsync({ id: pending.id, amountCents: pending.amountCents, bonusPoints: pending.bonusPoints });
      const bought = items.find((p) => p.id === pending.packId) ?? null;
      setPending(null);
      setSuccess({ creditCents: bought?.creditCents ?? pending.amountCents, bonusPoints: bought?.bonusPoints ?? pending.bonusPoints });
    } catch {
      show(t('wallet.paymentFail'), 'error');
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('wallet.topupTitle')}
        subtitle={t('wallet.topupBody')}
        right={<View style={{ flexDirection: 'row', alignItems: 'center' }}><Feather name="lock" size={13} color={colors.muted} /><Text variant="caption" color={colors.muted} style={{ marginLeft: 4 }}>Stripe</Text></View>}
      />

      <View style={{ gap: 10 }}>
        {items.map((item) => {
          const active = item.id === selected;
          return (
            <Pressable key={item.id} onPress={() => setSelected(item.id)}>
              <View
                style={{
                  borderWidth: 1.5,
                  borderColor: active ? colors.primary : colors.line,
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="h2" style={{ fontSize: 24 }}>
                      {item.label}
                    </Text>
                    {item.badge ? (
                      <View style={{ backgroundColor: colors.lime, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text variant="caption" color={colors.primary} style={{ fontSize: 10, fontWeight: '700' }}>
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" color={colors.muted} style={{ marginTop: 4 }}>
                    {formatBRL(item.creditCents)} · {t('wallet.bonus', { points: item.bonusPoints })}
                  </Text>
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: active ? colors.primary : colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                  {active ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        {t('checkout.paymentMethod')}
      </Text>
      {[
        { value: 'card' as const, icon: 'credit-card' as const, title: t('checkout.cardTitle'), body: t('checkout.cardBody') },
        { value: 'pix' as const, icon: 'zap' as const, title: 'PIX', body: t('checkout.pixBody') },
      ].map((option) => {
        const active = method === option.value;
        return (
          <Pressable key={option.value} onPress={() => setMethod(option.value)} style={{ marginBottom: 10 }}>
            <View style={{ borderWidth: 1.5, borderColor: active ? colors.primary : colors.line, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={option.icon} size={17} color={colors.inkSoft} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="small" style={{ fontWeight: '700' }}>
                  {option.title}
                </Text>
                <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                  {option.body}
                </Text>
              </View>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: active ? colors.primary : colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
              </View>
            </View>
          </Pressable>
        );
      })}

      <Card tone="muted" style={{ marginTop: spacing.sm }}>
        <Text variant="caption" color={colors.muted} style={{ lineHeight: 18 }}>
          {IS_DEMO ? t('checkout.demoNote') : t('checkout.liveNote')}
        </Text>
      </Card>

      <Button
        label={pack ? t('wallet.pay', { price: formatBRL(pack.priceCents) }) : t('common.loading')}
        size="lg"
        fullWidth
        style={{ marginTop: spacing.xl }}
        onPress={pay}
        loading={checkout.isPending}
        disabled={!pack}
        icon="lock"
      />

      <Sheet visible={!!pending} onClose={() => setPending(null)} title={t('wallet.payMock')}>
        <Text variant="body" color={colors.muted} style={{ lineHeight: 22 }}>
          {t('wallet.topupBody')}
        </Text>
        {success === null ? (
          <>
            <Card tone="muted" style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" color={colors.muted}>
                  {t('checkout.total')}
                </Text>
                <Text variant="h3">{pending ? formatBRL(pending.amountCents) : ''}</Text>
              </View>
            </Card>
            <Button label={t('checkout.simulateApproved')} size="lg" fullWidth style={{ marginTop: spacing.lg }} onPress={completeMock} loading={mockComplete.isPending} />
            <Button label={t('common.cancel')} variant="ghost" fullWidth style={{ marginTop: 6 }} onPress={() => setPending(null)} />
          </>
        ) : null}
      </Sheet>
      <Sheet visible={!!success} onClose={() => { setSuccess(null); router.replace('/wallet'); }} title={t('wallet.paymentSuccess')}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="check" size={28} color={colors.primary} />
          </View>
          <Text variant="body" color={colors.muted} align="center" style={{ marginTop: spacing.md }}>
            {t('wallet.paymentSuccessBody')}
          </Text>
          {success ? (
            <Text variant="h3" style={{ marginTop: spacing.sm }}>
              +{formatBRL(success.creditCents)} · +{formatPoints(success.bonusPoints)} pts
            </Text>
          ) : null}
          <Button label={t('common.continue')} fullWidth style={{ marginTop: spacing.lg }} onPress={() => { setSuccess(null); router.replace('/wallet'); }} />
        </View>
      </Sheet>
    </Screen>
  );
}
