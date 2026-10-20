import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { useT } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/tokens';

const faqs = [
  { q: 'help.faq1q', a: 'help.faq1a' },
  { q: 'help.faq2q', a: 'help.faq2a' },
  { q: 'help.faq3q', a: 'help.faq3a' },
  { q: 'help.faq4q', a: 'help.faq4a' },
];

export default function Help() {
  const t = useT();
  const { colors } = useTheme();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Screen scroll>
      <ScreenHeader title={t('help.title')} />

      <Card tone="muted">
        <Text variant="small" style={{ fontWeight: '700', marginBottom: 6 }}>
          {t('help.machineTitle')}
        </Text>
        <Text variant="caption" color={colors.muted} style={{ lineHeight: 18 }}>
          {t('help.machineBody')}
        </Text>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Text variant="label" color={colors.muted} style={{ marginBottom: 8, marginLeft: 4 }}>
          {t('help.faqSection')}
        </Text>
        {faqs.map((faq, index) => {
          const expanded = open === index;
          return (
            <Pressable key={faq.q} onPress={() => setOpen(expanded ? null : index)}>
              <View style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="small" style={{ flex: 1, fontWeight: '700' }}>
                    {t(faq.q)}
                  </Text>
                  <Feather name={expanded ? 'minus' : 'plus'} size={16} color={colors.muted} />
                </View>
                {expanded ? (
                  <Text variant="caption" color={colors.muted} style={{ marginTop: 8, lineHeight: 19 }}>
                    {t(faq.a)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Card style={{ marginTop: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="message-circle" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text variant="small" style={{ fontWeight: '700' }}>
              {t('help.contact')}
            </Text>
            <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
              {t('help.contactBody')}
            </Text>
          </View>
        </View>
        <Text
          variant="bodyMedium"
          color={colors.primary}
          style={{ marginTop: spacing.md, fontWeight: '700' }}
          onPress={() => Linking.openURL('mailto:ajuda@recio.app?subject=RecIO%20Rewards%20—%20Ajuda')}
        >
          ajuda@recio.app
        </Text>
      </Card>

      <Text variant="caption" color={colors.muted} align="center" style={{ marginTop: spacing.xl, lineHeight: 18 }}>
        {t('help.hours')}{'\n'}
        {t('help.lgpdContact')}
      </Text>
    </Screen>
  );
}
