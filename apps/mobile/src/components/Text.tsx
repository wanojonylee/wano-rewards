import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { type as typeScale } from '../theme/tokens';

type Variant = keyof typeof typeScale;

interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  uppercase?: boolean;
}

export function Text({ variant = 'body', color, align, uppercase, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        typeScale[variant],
        { color: color ?? colors.ink },
        align ? { textAlign: align } : null,
        uppercase ? { textTransform: 'uppercase' } : null,
        style,
      ]}
    />
  );
}

export const textStyles = StyleSheet.create({});
