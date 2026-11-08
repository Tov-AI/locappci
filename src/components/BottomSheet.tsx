import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, radius, space } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Optional text button on the right of the title, e.g. "Réinitialiser". */
  headerAction?: { label: string; onPress: () => void };
  children: ReactNode;
  /** Usually the sheet's primary Button. */
  footer?: ReactNode;
};

const DURATION = 220;

/**
 * Panel that slides up from the bottom over a dark overlay.
 * Closes on overlay tap and on the Android back button.
 * Moves up above the keyboard when a text field inside it is focused.
 */
export function BottomSheet({ visible, onClose, title, headerAction, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  // Stay mounted while the closing animation runs.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: DURATION, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: DURATION, useNativeDriver: true }).start(() =>
        setMounted(false),
      );
    }
  }, [visible, mounted, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
        pointerEvents="box-none">
      <Animated.View
        accessibilityViewIsModal
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) + space.sm, transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <AppText variant="headerTitle" accessibilityRole="header">
            {title}
          </AppText>
          {headerAction ? (
            <Pressable accessibilityRole="button" onPress={headerAction.onPress} hitSlop={10}>
              <AppText variant="secondaryStrong" color={colors.brand.navy}>
                {headerAction.label}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.body}>{children}</View>
        {footer}
      </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay },
  keyboard: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    gap: space.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.input,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  body: { gap: space.lg },
});
