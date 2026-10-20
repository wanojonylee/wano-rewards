import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { Text } from './Text';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  dismissable?: boolean;
}

export function Sheet({ visible, onClose, title, children, dismissable = true }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: visible ? 0 : 40, useNativeDriver: true, speed: 18, bounciness: 6 }),
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [visible, opacity, translateY]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity }]}>
        <Pressable style={{ flex: 1 }} onPress={dismissable ? onClose : undefined} />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.xl,
            transform: [{ translateY }],
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: spacing.lg }} />
          {title ? (
            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              {title}
            </Text>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export const sheetStyles = StyleSheet.create({});
