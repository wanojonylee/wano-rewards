import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Segmented } from '../src/components/TextField';
import { Sheet } from '../src/components/Sheet';
import { QRCodeView } from '../src/components/QRCodeView';
import { EmptyState } from '../src/components/ScreenHeader';
import { useMarkRedemptionUsed, useRedemptions } from '../src/lib/hooks';
import { useT, usePrefs } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/tokens';
import { formatDateFull } from '../src/lib/format';
import { useToast } from '../src/components/Toast';
import { rewardAccents } from '../src/theme/colors';
import type { Redemption } from '../src/types';

const iconFor: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  coffee: 'coffee',
  market: 'shopping-bag',
  cinema: 'film',
  transit: 'navigation',
  gym: 'activity',
  donation: 'heart',
  bottle: 'droplet',
  bag: 'briefcase',
  plant: 'feather',
  ticket: 'tag',
  icecream: 'sun',
  bookstore: 'book-open',
  streaming: 'play',
  bike: 'navigation',
};

export default function Orders() {
  const t = useT();
  const { colors } = useTheme();
  const locale = usePrefs((s) => s.locale);
  const { show } = useToast();
  const [status, setStatus] = useState('active');
  const redemptions = useRedemptions(status);
  const markUsed = useMarkRedemptionUsed();
  const [selected, setSelected] = useState<Redemption | null>(null);

  const items = redemptions.data?.items ?? [];

  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    show(t('common.copied'), 'success');
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t('orders.title')} />

      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: 'active', label: t('orders.active') },
          { value: 'used', label: t('orders.used') },
          { value: 'expired', label: t('orders.expired') },
        ]}
      />

      <View style={{ marginTop: spacing.lg, gap: 10 }}>
        {items.map((redemption) => {
          const accent = rewardAccents[redemption.reward.imageKey] ?? { bg: colors.surfaceMuted, fg: colors.ink };
          return (
            <Card key={redemption.id} onPress={() => setSelected(redemption)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: accent.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={iconFor[redemption.reward.imageKey] ?? 'gift'} size={20} color={accent.fg} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="small" style={{ fontWeight: '700' }}>
                    {redemption.reward.title}
                  </Text>
                  <Text variant="caption" color={colors.muted} style={{ marginTop: 3 }}>
                    {redemption.reward.partner} · {t('orders.validUntil', { date: formatDateFull(redemption.expiresAt, locale) })}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                    <Text variant="mono" style={{ fontSize: 12, letterSpacing: 1.5 }}>
                      {redemption.code}
                    </Text>
                    <Pressable onPress={() => copy(redemption.code)} hitSlop={8} style={{ marginLeft: 8 }}>
                      <Feather name="copy" size={13} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>
                <View
                  style={{
                    backgroundColor: redemption.status === 'active' ? colors.primarySoft : colors.surfaceMuted,
                    borderRadius: 999,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                  }}
                >
                  <Text variant="caption" color={redemption.status === 'active' ? colors.primary : colors.muted} style={{ fontWeight: '700', fontSize: 10 }}>
                    {redemption.status === 'active' ? t('orders.active') : redemption.status === 'used' ? t('orders.used') : t('orders.expired')}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
        {items.length === 0 ? <EmptyState icon={<Feather name="inbox" size={26} color={colors.muted} />} title={t('orders.empty')} body={t('rewards.emptyBody')} /> : null}
      </View>

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={t('orders.codeTitle')}>
        {selected ? (
          <View>
            <Text variant="body" color={colors.muted} align="center" style={{ marginBottom: spacing.md }}>
              {t('orders.codeBody')}
            </Text>
            <QRCodeView value={selected.qrPayload} size={172} />
            <Text variant="mono" align="center" style={{ marginTop: spacing.md, fontSize: 18 }}>
              {selected.code}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }} onTouchEnd={() => copy(selected.code)}>
                <Feather name="copy" size={13} color={colors.ink} />
                <Text variant="caption" style={{ marginLeft: 6, fontWeight: '600' }}>
                  {t('common.copy')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Feather name="clock" size={13} color={colors.ink} />
                <Text variant="caption" style={{ marginLeft: 6, fontWeight: '600' }}>
                  {t('orders.validUntil', { date: formatDateFull(selected.expiresAt, locale) })}
                </Text>
              </View>
            </View>
            {selected.status === 'active' ? (
              <Button
                label={t('orders.markUsed')}
                variant="secondary"
                fullWidth
                style={{ marginTop: spacing.lg }}
                loading={markUsed.isPending}
                onPress={async () => {
                  await markUsed.mutateAsync(selected.id);
                  setSelected(null);
                  show(t('orders.used'), 'success');
                }}
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}






