import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, size, space } from '@/theme';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  message: string;
  /** Optional next step, shown as a primary button. */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Empty and error state from the handoff: centred icon, title, one helpful sentence, one button.
 * Also used for tabs that are not built yet.
 */
export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Feather name={icon} size={48} color={colors.text.muted} />
      <AppText variant="cardTitle" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="meta" color={colors.text.body} style={styles.center}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <AppText variant="button" color={colors.text.inverse}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xxl * 2,
    paddingHorizontal: space.xxl,
  },
  center: { textAlign: 'center' },
  button: {
    marginTop: space.sm,
    minHeight: size.button,
    paddingHorizontal: space.xxl,
    borderRadius: radius.lg,
    backgroundColor: colors.brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.brand.navyDark },
});
