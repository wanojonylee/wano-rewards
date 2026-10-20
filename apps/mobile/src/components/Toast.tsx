import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { Text } from './Text';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), message, tone });
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translate, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
      ]).start();
      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(translate, { toValue: 12, duration: 180, useNativeDriver: true }),
        ]).start(() => setToast(null));
      }, 2600);
    },
    [opacity, translate],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastBubble toast={toast} opacity={opacity} translate={translate} />
    </ToastContext.Provider>
  );
}

function ToastBubble({ toast, opacity, translate }: { toast: ToastItem | null; opacity: Animated.Value; translate: Animated.Value }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  const icon = toast.tone === 'success' ? 'check-circle' : toast.tone === 'error' ? 'alert-circle' : 'info';
  const fg = toast.tone === 'error' ? colors.danger : toast.tone === 'info' ? colors.primary : colors.success;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: insets.bottom + 96 }]}>
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.ink,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          borderRadius: radii.pill,
          maxWidth: '88%',
          opacity,
          transform: [{ translateY: translate }],
        }}
      >
        <Feather name={icon} size={16} color={fg} style={{ marginRight: 8 }} />
        <Text variant="small" color={colors.bg} style={{ flexShrink: 1 }}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
