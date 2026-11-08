import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, radius, space } from '@/theme';

/**
 * Short message at the bottom of the screen ("Ajouté au panier"), with an optional action.
 * Call showToast() from anywhere; <ToastHost /> is mounted once in the root layout.
 */

type ToastMessage = {
  id: number;
  text: string;
  action?: { label: string; onPress: () => void };
};

const DURATION_MS = 3500;
/** Clear of the bottom action bar on detail screens, including its summary line. */
const BOTTOM_OFFSET = 120;

let current: ToastMessage | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(text: string, action?: ToastMessage['action']) {
  current = { id: nextId++, text, action };
  emit();
}

/** Remove the current message at once, e.g. when leaving the screen it was about. */
export function clearToast() {
  if (!current) return;
  current = null;
  emit();
}

function hideToast(id: number) {
  if (current?.id !== id) return; // A newer message replaced it.
  current = null;
  emit();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const message = useSyncExternalStore(subscribe, () => current);
  // Keep the last text on screen while it fades out.
  const [shown, setShown] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      setShown(message);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      const timer = setTimeout(() => hideToast(message.id), DURATION_MS);
      return () => clearTimeout(timer);
    }
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShown(null));
    return undefined;
  }, [message, opacity]);

  if (!shown) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, space.md) + BOTTOM_OFFSET }]}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { opacity }]}
        pointerEvents={message ? 'auto' : 'none'}>
        <AppText variant="secondary" color={colors.text.inverse} style={styles.text}>
          {shown.text}
        </AppText>
        {shown.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              hideToast(shown.id);
              shown.action?.onPress();
            }}>
            <AppText variant="secondaryStrong" color={colors.brand.onNavyMuted}>
              {shown.action.label}
            </AppText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.gutter, right: space.gutter },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.text.primary,
  },
  text: { flex: 1 },
});
