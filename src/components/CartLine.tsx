import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Stepper } from '@/components/Stepper';
import { ProductPhoto } from '@/components/ProductPhoto';
import type { CartItem } from '@/data/cart';
import { colors, radius, space } from '@/theme';
import { formatFcfa } from '@/utils/format';

const THUMB = 64;

/** A message under the line: red when it blocks payment, orange when it is only information. */
export type LineMessage = { text: string; blocking: boolean };

type Props = {
  item: CartItem;
  message?: LineMessage;
  onOpen: () => void;
  onQuantity: (n: number) => void;
  onRemove: () => void;
};

/** One cart line: photo, name, price, quantity, "Retirer". */
export function CartLine({ item, message, onOpen, onQuantity, onRemove }: Props) {
  return (
    <View style={styles.line}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voir ${item.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.top, pressed && styles.pressed]}>
        <View style={styles.thumb}>
          <ProductPhoto uri={item.coverUrl} iconSize={22} />
        </View>
        <View style={styles.texts}>
          <AppText variant="secondaryStrong" numberOfLines={2}>
            {item.name}
          </AppText>
          <AppText variant="bodyStrong">
            {formatFcfa(item.price)}
            {item.quantity > 1 ? (
              <AppText variant="caption" color={colors.text.muted}>
                {` × ${item.quantity} = ${formatFcfa(item.price * item.quantity)}`}
              </AppText>
            ) : null}
          </AppText>
        </View>
      </Pressable>

      {message ? (
        <View style={[styles.message, message.blocking ? styles.blocking : styles.info]}>
          <Feather
            name={message.blocking ? 'alert-circle' : 'info'}
            size={16}
            color={message.blocking ? colors.status.danger : colors.brand.orangeText}
          />
          <AppText
            variant="meta"
            color={message.blocking ? colors.status.danger : colors.brand.orangeTextDark}
            style={styles.flex}
            accessibilityRole="alert">
            {message.text}
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        {item.maxQuantity === 0 ? (
          // Sold out: nothing to adjust, only "Retirer".
          <View />
        ) : (
          <Stepper
            value={item.quantity}
            onChange={onQuantity}
            min={1}
            max={item.maxQuantity ?? 99}
            accessibilityLabel={`Quantité de ${item.name}`}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${item.name} du panier`}
          hitSlop={8}
          onPress={onRemove}
          style={styles.link}>
          <Feather name="trash-2" size={16} color={colors.text.muted} />
          <AppText variant="secondaryStrong" color={colors.text.muted}>
            Retirer
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { gap: space.md },
  top: { flexDirection: 'row', gap: space.md },
  pressed: { opacity: 0.85 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  flex: { flex: 1 },
  message: { flexDirection: 'row', gap: space.sm, padding: 10, borderRadius: radius.sm },
  blocking: { backgroundColor: colors.surface.neutral },
  info: { backgroundColor: colors.brand.orangeTint },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
});
