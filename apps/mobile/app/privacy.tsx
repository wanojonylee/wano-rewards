import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { ListRow } from '../src/components/ListRow';
import { Sheet } from '../src/components/Sheet';
import { TextField } from '../src/components/TextField';
import { useConsent, useDeleteAccount, useExportData, useProfile } from '../src/lib/hooks';
import { useT } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/tokens';
import { formatDateFull } from '../src/lib/format';
import { useToast } from '../src/components/Toast';

export default function Privacy() {
  const t = useT();
  const { colors } = useTheme();
  const { show } = useToast();
  const profile = useProfile();
  const consent = useConsent();
  const exportData = useExportData();
  const deleteAccount = useDeleteAccount();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const user = profile.data?.user;
  const marketing = user?.consent.marketingOptIn ?? false;
  const word = t('privacy.deleteWord');

  return (
    <Screen scroll>
      <ScreenHeader title={t('privacy.title')} />

      <Card style={{ backgroundColor: colors.primary, borderColor: 'transparent' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(216,238,139,0.95)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="shield" size={17} color={colors.primary} />
          </View>
          <Text variant="h3" color={colors.primaryInk} style={{ marginLeft: 10, flex: 1 }}>
            {t('privacy.lgpdTitle')}
          </Text>
        </View>
        <Text variant="small" color={'rgba(246,243,234,0.75)'} style={{ marginTop: spacing.md, lineHeight: 20 }}>
          {t('privacy.lgpdBody')}
        </Text>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Text variant="label" color={colors.muted} style={{ marginBottom: 6, marginLeft: 4 }}>
          {t('privacy.consent')}
        </Text>
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  LGPD
                </Text>
                <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                  {user?.consent.lgpdAt
                    ? t('privacy.acceptedAt', { date: formatDateFull(user.consent.lgpdAt) })
                    : t('privacy.pendingAcceptance')}
                </Text>
              </View>
              <Feather name="check-circle" size={18} color={colors.success} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                {t('privacy.marketing')}
              </Text>
              <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                {t('privacy.marketingBody')}
              </Text>
            </View>
            <Switch
              value={marketing}
              onValueChange={(value) => {
                consent.mutate({ lgpd: true, marketing: value });
                show(t('common.save'), 'success');
              }}
              trackColor={{ false: colors.lineStrong, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </Card>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <Text variant="label" color={colors.muted} style={{ marginBottom: 6, marginLeft: 4 }}>
          {t('privacy.rights')}
        </Text>
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <ListRow
            icon="download"
            title={t('privacy.export')}
            subtitle={t('privacy.exportBody')}
            onPress={async () => {
              await exportData.mutateAsync();
              show(t('privacy.requested'), 'success');
            }}
          />
          <ListRow icon="trash-2" title={t('privacy.delete')} subtitle={t('privacy.deleteBody')} danger onPress={() => setDeleteOpen(true)} last />
        </Card>
      </View>

      <Card tone="muted" style={{ marginTop: spacing.lg }}>
        <Text variant="small" style={{ fontWeight: '700', marginBottom: 6 }}>
          {t('privacy.retentionTitle')}
        </Text>
        <Text variant="caption" color={colors.muted} style={{ lineHeight: 18 }}>
          {t('privacy.retentionBody')}
        </Text>
      </Card>

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('privacy.delete')}>
        <Text variant="body" color={colors.muted} style={{ lineHeight: 22 }}>
          {t('privacy.deleteWarn')}
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <TextField value={confirmation} onChangeText={setConfirmation} placeholder={word} autoCapitalize="characters" />
        </View>
        <Button
          label={t('privacy.delete')}
          variant="danger"
          size="lg"
          fullWidth
          style={{ marginTop: spacing.lg }}
          disabled={confirmation.trim().toUpperCase() !== word}
          loading={deleteAccount.isPending}
          onPress={async () => {
            await deleteAccount.mutateAsync();
            setDeleteOpen(false);
            setConfirmation('');
            show(t('privacy.requested'), 'success');
          }}
        />
        <Button label={t('common.cancel')} variant="ghost" fullWidth style={{ marginTop: 6 }} onPress={() => setDeleteOpen(false)} />
      </Sheet>
    </Screen>
  );
}
