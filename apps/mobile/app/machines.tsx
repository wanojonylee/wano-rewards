import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { useMachines, useStartSession } from '../src/lib/hooks';
import { useT } from '../src/store/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/tokens';
import { ProgressBar } from '../src/components/Pill';
import { useToast } from '../src/components/Toast';

const statusKey: Record<string, string> = {
  online: 'machines.online',
  full: 'machines.full',
  maintenance: 'machines.maintenance',
};

export default function Machines() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { show } = useToast();
  const machines = useMachines();
  const start = useStartSession();

  const begin = async (code: string) => {
    try {
      const result = await start.mutateAsync(code);
      router.push(`/session/${result.session.id}`);
    } catch {
      show(t('common.error'), 'error');
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t('machines.title')} subtitle={t('machines.subtitle')} />

      <View style={{ gap: 10 }}>
        {(machines.data?.items ?? []).map((machine) => {
          const color = machine.status === 'online' ? colors.success : machine.status === 'full' ? colors.warning : colors.danger;
          return (
            <Card key={machine.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="cpu" size={20} color={colors.inkSoft} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="small" style={{ fontWeight: '700' }}>
                    {machine.name}
                  </Text>
                  <Text variant="caption" color={colors.muted} numberOfLines={1} style={{ marginTop: 2 }}>
                    {machine.address} · {machine.distanceMeters} m
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 5 }} />
                  <Text variant="caption" style={{ fontWeight: '700', fontSize: 10 }}>
                    {t(statusKey[machine.status])}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <ProgressBar value={machine.fillPercent / 100} height={5} color={machine.status === 'full' ? colors.warning : colors.primary} />
                </View>
                <Text variant="caption" color={colors.muted}>
                  {t('machines.fill', { percent: machine.fillPercent })}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 }}>
                  {machine.materials.slice(0, 3).map((material) => (
                    <View key={material} style={{ backgroundColor: colors.surfaceMuted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 }}>
                      <Text variant="caption" style={{ fontSize: 9, fontWeight: '700' }}>
                        {material}
                      </Text>
                    </View>
                  ))}
                  {machine.materials.length > 3 ? (
                    <Text variant="caption" color={colors.muted} style={{ alignSelf: 'center' }}>
                      +{machine.materials.length - 3}
                    </Text>
                  ) : null}
                </View>
                <Button
                  label={t('scan.start')}
                  size="sm"
                  disabled={machine.status !== 'online'}
                  loading={start.isPending}
                  onPress={() => begin(machine.code)}
                />
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

