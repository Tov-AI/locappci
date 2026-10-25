import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, space } from '@/theme';

type Props = {
  label: string;
  onPress?: () => void;
  /** Active chips are filled navy (e.g. "Filtres · 2"). */
  active?: boolean;
  icon?: ComponentProps<typeof Feather>['name'];
  /** Grey, non-tappable chip (e.g. "Bientôt" universes). */
  muted?: boolean;
  style?: ViewStyle;
};

/** Pill chip, height 36, 13/600: filters, categories, "coming soon" universes. */
export function Chip({ label, onPress, active = false, icon, muted = false, style }: Props) {
  const fg = active ? colors.text.inverse : muted ? colors.text.muted : colors.text.primary;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected: active } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        active ? styles.active : styles.idle,
        muted && styles.muted,
        pressed && !active && styles.pressed,
        style,
      ]}>
      {icon ? <Feather name={icon} size={14} color={fg} /> : null}
      <AppText variant="metaStrong" color={fg} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  idle: { backgroundColor: colors.surface.card, borderColor: colors.border.input },
  active: { backgroundColor: colors.brand.navy, borderColor: colors.brand.navy },
  muted: { borderColor: colors.border.default },
  pressed: { backgroundColor: colors.surface.field },
});
