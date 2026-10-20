import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { Card } from '../../src/components/Card';
import { useMachines, useStartSession } from '../../src/lib/hooks';
import { useT } from '../../src/store/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radii, spacing } from '../../src/theme/tokens';
import { useToast } from '../../src/components/Toast';
import { withAlpha } from '../../src/lib/color';
import type { Machine } from '../../src/types';

function statusLabel(machine: Machine) {
  if (machine.status === 'online') return { key: 'machines.online', color: 'success' as const };
  if (machine.status === 'full') return { key: 'machines.full', color: 'warning' as const };
  return { key: 'machines.maintenance', color: 'danger' as const };
}

export default function Scan() {
  const t = useT();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { show } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const machines = useMachines();
  const startSession = useStartSession();
  const [code, setCode] = useState('');
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') requestPermission().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = async (machineCode: string) => {
    if (!machineCode.trim() || startSession.isPending) return;
    try {
      const result = await startSession.mutateAsync(machineCode.trim().toUpperCase());
      router.push(`/session/${result.session.id}`);
    } catch (e: any) {
      const message = e?.message ?? '';
      if (message.includes('ALREADY_ACTIVE')) show(t('scan.activeSession'), 'error');
      else show(t('common.error'), 'error');
      setScanned(false);
    }
  };

  const onScanned = (value: string) => {
    if (scanned) return;
    setScanned(true);
    const parts = value.split('/');
    begin(parts[parts.length - 1] || 'RVM-SP-001');
  };

  const cameraReady = Platform.OS !== 'web' && permission?.granted;
  const nearby = machines.data?.items ?? [];

  return (
    <Screen scroll edges={['top']} bottomInset={100}>
      <View style={{ paddingTop: spacing.sm }}>
        <Text variant="label" color={colors.muted}>
          {t('scan.eyebrow')}
        </Text>
        <Text variant="h1" style={{ marginTop: 6 }}>
          {t('scan.title')}
        </Text>
        <Text variant="body" color={colors.muted} style={{ marginTop: 4 }}>
          {t('scan.subtitle')}
        </Text>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <View
          style={{
            height: 260,
            borderRadius: radii.xl,
            backgroundColor: '#0E1A14',
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {cameraReady ? (
            <CameraView
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(event) => onScanned(event.data)}
            />
          ) : (
            <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: withAlpha('#FFFFFF', 0.08), alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="camera" size={22} color="#F6F3EA" />
              </View>
              <Text variant="small" color="#F6F3EA" align="center" style={{ marginTop: 12 }}>
                {t('scan.permissionTitle')}
              </Text>
              <Text variant="caption" align="center" color={withAlpha('#F6F3EA', 0.6)} style={{ marginTop: 4, maxWidth: 280, lineHeight: 17 }}>
                {Platform.OS === 'web' ? t('scan.manualBody') : t('scan.permissionBody')}
              </Text>
              {Platform.OS !== 'web' && !permission?.granted ? (
                <Pressable onPress={requestPermission} style={{ marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.lime }}>
                  <Text variant="caption" color="#0C3B2A" style={{ fontWeight: '700' }}>
                    {t('scan.grant')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {/* viewfinder corners */}
          {[
            { top: 18, left: 18, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 12 },
            { top: 18, right: 18, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 12 },
            { bottom: 18, left: 18, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 12 },
            { bottom: 18, right: 18, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 12 },
          ].map((style, index) => (
            <View key={index} style={[{ position: 'absolute', width: 34, height: 34, borderColor: withAlpha('#F6F3EA', 0.75) }, style as any]} />
          ))}
          <View style={{ position: 'absolute', bottom: 22, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lime, marginRight: 6 }} />
            <Text variant="caption" color={withAlpha('#F6F3EA', 0.7)}>
              {t('scan.waiting')}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <Text variant="h3">{t('scan.manualTitle')}</Text>
        <Text variant="caption" color={colors.muted} style={{ marginTop: 4 }}>
          {t('scan.manualBody')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField value={code} onChangeText={setCode} placeholder={t('scan.manualPlaceholder')} autoCapitalize="characters" />
          </View>
          <Button label={t('scan.start')} onPress={() => begin(code)} loading={startSession.isPending} disabled={!code.trim()} />
        </View>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text variant="h3">{t('scan.nearby')}</Text>
          <Text variant="caption" color={colors.muted} onPress={() => router.push('/machines')}>
            {t('common.seeAll')}
          </Text>
        </View>
        {nearby.slice(0, 3).map((machine, index) => {
          const status = statusLabel(machine);
          return (
            <Card key={machine.id} onPress={() => begin(machine.code)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: isDark ? colors.surfaceMuted : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="cpu" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="small" style={{ fontWeight: '700' }}>
                    {machine.name}
                  </Text>
                  <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                    {machine.distanceMeters} m · {machine.code}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors[status.color], marginRight: 5 }} />
                  <Text variant="caption" color={colors.muted}>
                    {t(status.key)}
                  </Text>
                  <Feather name="chevron-right" size={15} color={colors.lineStrong} style={{ marginLeft: 4 }} />
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
