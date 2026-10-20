import React from 'react';
import { Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { Segmented } from '../src/components/TextField';
import { ListRow } from '../src/components/ListRow';
import { useTheme } from '../src/theme/ThemeProvider';
import { useT, usePrefs } from '../src/store/prefs';
import { spacing } from '../src/theme/tokens';
import { IS_DEMO } from '../src/lib/api';
import type { Locale } from '../src/types';

export default function Settings() {
  const t = useT();
  const router = useRouter();
  const { colors, preference, setPreference } = useTheme();
  const { locale, setLocale, pushEnabled, setPush, emailEnabled, setEmail } = usePrefs();

  const switchColor = { false: colors.lineStrong, true: colors.primary };

  return (
    <Screen scroll>
      <ScreenHeader title={t('settings.title')} />

      <Text variant="label" color={colors.muted} style={{ marginBottom: 8, marginLeft: 4 }}>
        {t('settings.appearance')}
      </Text>
      <Segmented
        value={preference}
        onChange={(value) => setPreference(value as 'system' | 'light' | 'dark')}
        options={[
          { value: 'system', label: t('settings.theme.system') },
          { value: 'light', label: t('settings.theme.light') },
          { value: 'dark', label: t('settings.theme.dark') },
        ]}
      />

      <Text variant="label" color={colors.muted} style={{ marginTop: spacing.xl, marginBottom: 8, marginLeft: 4 }}>
        {t('settings.language')}
      </Text>
      <Segmented
        value={locale}
        onChange={(value) => setLocale(value as Locale)}
        options={[
          { value: 'zh-Hant', label: '繁體中文' },
          { value: 'en', label: 'English' },
        ]}
      />

      <Card padded={false} style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Feather name="bell" size={17} color={colors.inkSoft} style={{ width: 34 }} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
              {t('settings.push')}
            </Text>
            <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
              {t('settings.pushBody')}
            </Text>
          </View>
          <Switch value={pushEnabled} onValueChange={setPush} trackColor={switchColor} thumbColor={colors.surface} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
          <Feather name="mail" size={17} color={colors.inkSoft} style={{ width: 34 }} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
              {t('settings.email')}
            </Text>
            <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
              {t('settings.emailBody')}
            </Text>
          </View>
          <Switch value={emailEnabled} onValueChange={setEmail} trackColor={switchColor} thumbColor={colors.surface} />
        </View>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Text variant="label" color={colors.muted} style={{ marginBottom: 6, marginLeft: 4 }}>
          {t('settings.legal')}
        </Text>
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <ListRow icon="shield" title={t('settings.privacy')} onPress={() => router.push('/privacy')} />
          <ListRow icon="file-text" title={t('settings.terms')} onPress={() => router.push('/help')} />
          <ListRow icon="help-circle" title={t('profile.help')} onPress={() => router.push('/help')} last />
        </Card>
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
        <Text variant="caption" color={colors.muted}>
          {t('settings.version', { version: '1.0.0 (build 42)' })}
        </Text>
        {IS_DEMO ? (
          <View style={{ marginTop: 8, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
              {t('settings.demoMode')}
            </Text>
          </View>
        ) : null}
        <Text variant="caption" color={colors.muted} style={{ marginTop: 12, textAlign: 'center', maxWidth: 280, lineHeight: 17 }}>
          {t('settings.operator')}
        </Text>
      </View>
    </Screen>
  );
}
