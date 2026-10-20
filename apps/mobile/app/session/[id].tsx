import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radii, spacing } from '../../src/theme/tokens';
import { Text } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/Pill';
import { IconButton } from '../../src/components/Card';
import { Skeleton } from '../../src/components/Skeleton';
import { useCompleteSession, useSimulateDeposit } from '../../src/lib/hooks';
import { sessionApi, IS_DEMO } from '../../src/lib/api';
import { useT, usePrefs } from '../../src/store/prefs';
import { formatBRL, formatKg, formatPoints } from '../../src/lib/format';
import { withAlpha } from '../../src/lib/color';
import { materialColors } from '../../src/theme/colors';
import type { Deposit, Session } from '../../src/types';

const materialIcon: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  PET: 'droplet',
  ALUMINUM: 'circle',
  GLASS: 'square',
  HDPE: 'package',
  PP: 'box',
  PS_HIPS: 'layers',
};

export default function SessionScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const locale = usePrefs((s) => s.locale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const simulate = useSimulateDeposit();
  const complete = useCompleteSession();
  const autoAdded = useRef(0);

  useEffect(() => {
    let active = true;
    sessionApi
      .get(id ?? '')
      .then((result) => {
        if (active) setSession(result.session);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!session || session.status !== 'active') return;
    const timer = setInterval(() => {
      sessionApi.get(session.id).then((result) => {
        if (result.session) setSession(result.session);
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [session?.id, session?.status]);

  useEffect(() => {
    if (!IS_DEMO || !session || session.status !== 'active') return;
    if (session.deposits.length >= 4 || autoAdded.current >= 4) return;
    const timer = setTimeout(async () => {
      autoAdded.current += 1;
      try {
        const result = await simulate.mutateAsync({ id: session.id });
        setSession(result.session);
      } catch {
        // ignore demo hiccups
      }
    }, 1600);
    return () => clearTimeout(timer);
  }, [session?.deposits.length, session?.status, session?.id]);

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 16, paddingHorizontal: spacing.lg }}>
        <Skeleton width="50%" height={20} />
        <Skeleton height={180} radius={20} style={{ marginTop: 20 }} />
        <Skeleton height={80} radius={16} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const finished = session.status === 'completed';
  const machine = session.machine;
  const totals = session.totals;

  if (finished && session.receipt) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12, paddingHorizontal: spacing.lg }}>
        <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="check" size={36} color={colors.primary} />
          </View>
          <Text variant="hero" style={{ marginTop: spacing.lg }}>
            {t('scan.completed')}
          </Text>
          <Text variant="body" color={colors.muted} align="center" style={{ marginTop: 6, maxWidth: 300 }}>
            {t('scan.receiptBody')}
          </Text>
        </View>

        <Card style={{ marginTop: spacing.xl }}>
          <Text variant="label" color={colors.muted}>
            {t('scan.receipt')}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="display" style={{ fontSize: 40, lineHeight: 44 }}>
                +{formatPoints(session.receipt.points)}
              </Text>
              <Text variant="caption" color={colors.muted}>
                {t('common.points')}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="display" style={{ fontSize: 40, lineHeight: 44 }}>
                {formatBRL(session.receipt.cashbackCents)}
              </Text>
              <Text variant="caption" color={colors.muted}>
                {t('wallet.credit')}
              </Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: spacing.md }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text variant="caption" color={colors.muted}>
                {t('impact.items')}
              </Text>
              <Text variant="h3" style={{ marginTop: 2 }}>
                {session.receipt.items}
              </Text>
            </View>
            <View>
              <Text variant="caption" color={colors.muted}>
                {t('scan.weight')}
              </Text>
              <Text variant="h3" style={{ marginTop: 2 }}>
                {formatKg(session.receipt.co2Grams / 1.6)}
              </Text>
            </View>
            <View>
              <Text variant="caption" color={colors.muted}>
                CO₂
              </Text>
              <Text variant="h3" style={{ marginTop: 2 }}>
                {(session.receipt.co2Grams / 1000).toFixed(1)} kg
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 'auto', paddingBottom: insets.bottom + spacing.lg }}>
          <Button label={t('scan.newSession')} size="lg" fullWidth onPress={() => router.replace('/scan')} />
          <Button label={t('tabs.home')} variant="ghost" fullWidth style={{ marginTop: 6 }} onPress={() => router.replace('/home')} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top + 10, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime, marginRight: 7 }} />
            <Text variant="caption" color={withAlpha(colors.primaryInk, 0.8)} style={{ fontWeight: '600' }}>
              {t('scan.session')} · {machine.code}
            </Text>
          </View>
          <IconButton name="x" background={withAlpha('#FFFFFF', 0.12)} bordered={false} tint={colors.primaryInk} onPress={() => router.replace('/home')} />
        </View>

        <Text variant="caption" color={withAlpha(colors.primaryInk, 0.6)} style={{ marginTop: spacing.lg }}>
          {machine.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 }}>
          <Text variant="display" color={colors.primaryInk} style={{ fontSize: 68, lineHeight: 72 }}>
            {totals.items}
          </Text>
          <Text variant="body" color={withAlpha(colors.primaryInk, 0.7)} style={{ marginLeft: 8, marginBottom: 12 }}>
            {t('scan.items')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 24, marginTop: spacing.md }}>
          <View>
            <Text variant="caption" color={withAlpha(colors.primaryInk, 0.6)}>
              {t('scan.weight')}
            </Text>
            <Text variant="h3" color={colors.primaryInk} style={{ marginTop: 2 }}>
              {formatKg(totals.weightGrams)}
            </Text>
          </View>
          <View>
            <Text variant="caption" color={withAlpha(colors.primaryInk, 0.6)}>
              {t('scan.earned')}
            </Text>
            <Text variant="h3" color={colors.primaryInk} style={{ marginTop: 2 }}>
              {formatPoints(totals.points)} pts
            </Text>
          </View>
          <View>
            <Text variant="caption" color={withAlpha(colors.primaryInk, 0.6)}>
              {t('wallet.credit')}
            </Text>
            <Text variant="h3" color={colors.lime} style={{ marginTop: 2 }}>
              {formatBRL(totals.cashbackCents)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
        <View style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text variant="caption" color={colors.muted}>
              {t('scan.sessionBody')}
            </Text>
            <Text variant="caption" color={colors.muted}>
              {totals.items}/40
            </Text>
          </View>
          <ProgressBar value={totals.items / 40} height={6} />
        </View>

        {IS_DEMO ? (
          <Pressable
            onPress={async () => {
              try {
                const result = await simulate.mutateAsync({ id: session.id });
                setSession(result.session);
              } catch {
                // ignore
              }
            }}
            style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}
          >
            <Feather name="plus-circle" size={13} color={colors.muted} />
            <Text variant="caption" color={colors.muted} style={{ marginLeft: 6, fontWeight: '600' }}>
              {t('scan.demoDeposit')}
            </Text>
          </Pressable>
        ) : null}

        <View style={{ marginTop: spacing.md, flex: 1 }}>
          {session.deposits.slice(0, 4).map((deposit: Deposit) => (
            <View key={deposit.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: withAlpha(materialColors[deposit.material] ?? colors.primary, isDark ? 0.3 : 0.16), alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={materialIcon[deposit.material] ?? 'package'} size={15} color={materialColors[deposit.material] ?? colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text variant="small" style={{ fontWeight: '600' }} numberOfLines={1}>
                  {deposit.skuName}
                </Text>
                <Text variant="caption" color={colors.muted} style={{ marginTop: 1 }}>
                  {deposit.material} · {deposit.weightGrams} g
                </Text>
              </View>
              <Text variant="small" color={colors.success} style={{ fontWeight: '700' }}>
                +{deposit.points} pts
              </Text>
            </View>
          ))}
        </View>

        <View style={{ paddingBottom: insets.bottom + spacing.lg, paddingTop: spacing.sm }}>
          <Button
            label={t('scan.finish')}
            size="lg"
            fullWidth
            onPress={async () => {
              const result = await complete.mutateAsync(session.id);
              setSession(result.session);
            }}
            loading={complete.isPending}
            icon="check"
          />
          <Text variant="caption" color={colors.muted} align="center" style={{ marginTop: 8 }}>
            {t('scan.finishHint')}
          </Text>
        </View>
      </View>
    </View>
  );
}

