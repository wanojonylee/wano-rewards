import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../theme/ThemeProvider';
import { radii } from '../theme/tokens';

interface QRCodeViewProps {
  value: string;
  size?: number;
}

export function QRCodeView({ value, size = 180 }: QRCodeViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: radii.md,
        alignSelf: 'center',
      }}
    >
      <QRCode value={value} size={size} backgroundColor="#FFFFFF" color="#14160F" ecl="M" />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 6, alignItems: 'center' }}>
        <View style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: colors.line }} />
      </View>
    </View>
  );
}
