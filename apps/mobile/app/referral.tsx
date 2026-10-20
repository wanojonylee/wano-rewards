import React from 'react';
import { Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { useReferral } from '../src/lib/hooks';
import { useT } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/tokens';
import { formatPoints } from '../src/lib/format';
import { useToast } from '../src/components/Toast';

export default function Referral() {
  const t = useT();
  const { colors } = useTheme();
  const { show } = useToast();
  const referral = useReferral();
  const data = referral.data;

  const copy = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.code);
    show(t('common.copied'), 'success');
  };

  const share = async () => {
    if (!data) return;
    try {
      await Share.share({
        message: t('referral.shareMessage', { code: data.code, points: data.rewardPerFriend, link: data.link }),
      });
    } catch {
      show(t('common.soon'), 'info');
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t('referral.title')} subtitle={data ? t('referral.subtitle', { points: data.rewardPerFriend }) : undefined} />

      <Card style={{ backgroundColor: colors.primary, borderColor: 'transparent' }}>
        <Text variant="label" color={'rgba(246,243,234,0.6)'}>
          {t('referral.code')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <Text variant="display" color={colors.primaryInk} style={{ fontSize: 42, letterSpacing: 2, flex: 1 }}>
            {data?.code ?? '—'}
          </Text>
          <View
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}
            onTouchEnd={copy}
          >
            <Feather name="copy" size={17} color={colors.primary} />
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(246,243,234,0.18)', marginVertical: spacing.md }} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text variant="h2" color={colors.primaryInk}>
              {data?.invited ?? 0}
            </Text>
            <Text variant="caption" color={'rgba(246,243,234,0.65)'}>
              {t('referral.invited')}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(246,243,234,0.18)', marginHorizontal: spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text variant="h2" color={colors.lime}>
              {formatPoints(data?.earnedPoints ?? 0)}
            </Text>
            <Text variant="caption" color={'rgba(246,243,234,0.65)'}>
              {t('referral.earned')}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button label={t('referral.invite')} onPress={share} icon="share-2" fullWidth />
        </View>
        <View style={{ width: 130 }}>
          <Button label={t('common.copy')} variant="secondary" onPress={copy} icon="copy" fullWidth />
        </View>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <Text variant="h3" style={{ marginBottom: spacing.sm }}>
          {t('referral.rules')}
        </Text>
        {(data?.rules ?? [t('referral.rule1'), t('referral.rule2'), t('referral.rule3')]).map((rule, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Text variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>
                {index + 1}
              </Text>
            </View>
            <Text variant="small" color={colors.inkSoft} style={{ flex: 1, lineHeight: 20, paddingTop: 3 }}>
              {rule}
            </Text>
          </View>
        ))}
      </View>

      <Card tone="muted" style={{ marginTop: spacing.md }}>
        <Text variant="caption" color={colors.muted} style={{ lineHeight: 18 }}>
          {t('referral.limitNote')}
        </Text>
      </Card>
    </Screen>
  );
}



