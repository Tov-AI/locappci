import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { colors, size } from '@/theme';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  /** Read aloud by screen readers, e.g. "Retour", "Partager". Required: the button has no text. */
  accessibilityLabel: string;
  onPress?: () => void;
  /** Draw a light border, used on grey or white backgrounds. Photos use no border. */
  bordered?: boolean;
  iconColor?: string;
  style?: ViewStyle;
};

/** 44 × 44 white round button for back, share and favourite. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  bordered = false,
  iconColor = colors.text.primary,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        bordered && styles.bordered,
        pressed && styles.pressed,
        style,
      ]}>
      <Feather name={icon} size={20} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: size.touch,
    height: size.touch,
    borderRadius: size.touch / 2,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bordered: { borderWidth: 1, borderColor: colors.border.default },
  pressed: { backgroundColor: colors.surface.field },
});
