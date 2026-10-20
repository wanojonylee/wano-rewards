import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { Text } from './Text';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  icon?: React.ComponentProps<typeof Feather>['name'];
  right?: React.ReactNode;
  hint?: string;
}

export function TextField({ label, error, icon, right, hint, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.line;

  return (
    <View>
      {label ? (
        <Text variant="caption" color={colors.muted} style={{ marginBottom: 8, fontWeight: '600' }}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: colors.surface,
            borderColor,
          },
        ]}
      >
        {icon ? <Feather name={icon} size={17} color={colors.muted} style={{ marginRight: 10 }} /> : null}
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.ink }, style]}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          autoCorrect={false}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" color={colors.danger} style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={colors.muted} style={{ marginTop: 6 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

interface SegmentedProps {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}

export function Segmented({ options, value, onChange }: SegmentedProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Text
            key={option.value}
            variant="small"
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              textAlign: 'center',
              paddingVertical: 9,
              borderRadius: radii.pill,
              overflow: 'hidden',
              fontWeight: '600',
              backgroundColor: active ? colors.surface : 'transparent',
              color: active ? colors.ink : colors.muted,
            }}
          >
            {option.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 13,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    padding: 4,
  },
});
