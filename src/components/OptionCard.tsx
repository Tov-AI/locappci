import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, space } from '@/theme';

type Props = {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
  /** Optional tile on the left, e.g. a payment method initial. */
  leading?: ReactNode;
  /** Hide the radio ring (used in compact grids like delivery choices). */
  hideRadio?: boolean;
  style?: ViewStyle;
};

/**
 * Single choice in a group (payment, delivery, dates, filters).
 * Selected: 2 pt navy border + light navy fill + filled radio.
 */
export function OptionCard({ label, hint, selected, onSelect, leading, hideRadio = false, style }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.idle,
        pressed && !selected && styles.pressed,
        style,
      ]}>
      {leading}
      <View style={styles.texts}>
        <AppText variant="secondaryStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" color={colors.text.muted}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {hideRadio ? null : (
        <View style={[styles.ring, selected && styles.ringOn]}>
          {selected ? <View style={styles.dot} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Small square tile with initials, for payment methods. Neutral: no brand logos. */
export function InitialTile({ text }: { text: string }) {
  return (
    <View style={styles.tile}>
      <AppText variant="secondaryStrong" color={colors.text.body}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  idle: { borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface.card },
  selected: { borderWidth: 2, borderColor: colors.brand.navy, backgroundColor: colors.brand.navySelected },
  pressed: { backgroundColor: colors.surface.field },
  texts: { flex: 1, gap: 2 },
  ring: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.radio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOn: { borderColor: colors.brand.navy },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand.navy },
  tile: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
