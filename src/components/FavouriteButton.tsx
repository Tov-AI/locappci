import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { colors, size } from '@/theme';

type Props = {
  saved: boolean;
  onToggle: () => void;
  /** Small (32) on product cards, regular (44) on detail screens. */
  small?: boolean;
  style?: ViewStyle;
};

/**
 * Favourite heart: outline when not saved, orange fill when saved.
 * The parent updates `saved` straight away (optimistic) and syncs later.
 */
export function FavouriteButton({ saved, onToggle, small = false, style }: Props) {
  const box = small ? 32 : size.touch;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      accessibilityState={{ selected: saved }}
      onPress={onToggle}
      // Keeps the touch area at 44 even when the circle is drawn smaller.
      hitSlop={small ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        { width: box, height: box, borderRadius: box / 2 },
        pressed && styles.pressed,
        style,
      ]}>
      <Ionicons
        name={saved ? 'heart' : 'heart-outline'}
        size={small ? 17 : 21}
        color={saved ? colors.brand.orange : colors.text.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.surface.field },
});
