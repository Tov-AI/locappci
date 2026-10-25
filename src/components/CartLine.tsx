import Feather from '@expo/vector-icons/Feather';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Stepper } from '@/components/Stepper';
import type { CartItem } from '@/data/cart';
import { colors, radius, space } from '@/theme';
import { addDays, formatDayCompact, formatDays } from '@/utils/dates';
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

/** One cart line: photo, name, price, quantity (sale) or dates (rental), "Retirer". */
export function CartLine({ item, message, onOpen, onQuantity, onRemove }: Props) {
  const r = item.rental;
  return (
    <View style={styles.line}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voir ${item.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.top, pressed && styles.pressed]}>
        <View style={[styles.thumb, { backgroundColor: r ? colors.brand.orangeTint : colors.brand.navyTint }]}>
          <Feather name="image" size={22} color={r ? colors.brand.orangeBorder : colors.brand.navyMuted} />
          {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.image} resizeMode="cover" /> : null}
        </View>
        <View style={styles.texts}>
          <AppText variant="secondaryStrong" numberOfLines={2}>
            {item.name}
          </AppText>
          {r ? (
            <>
              <AppText variant="meta" color={colors.text.body}>
                {r.days === 1
                  ? `Location 1 jour · le ${formatDayCompact(r.startDate)}`
                  : `Location ${formatDays(r.days)} · du ${formatDayCompact(r.startDate)} au ${formatDayCompact(addDays(r.startDate, r.days - 1))}`}
              </AppText>
              <AppText variant="bodyStrong">{formatFcfa(item.price)}</AppText>
              <AppText variant="caption" color={colors.text.muted}>
                {`+ caution ${formatFcfa(r.deposit)}, rendue au retour`}
              </AppText>
            </>
          ) : (
            <AppText variant="bodyStrong">
              {formatFcfa(item.price)}
              {item.quantity > 1 ? (
                <AppText variant="caption" color={colors.text.muted}>
                  {` × ${item.quantity} = ${formatFcfa(item.price * item.quantity)}`}
                </AppText>
              ) : null}
            </AppText>
          )}
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
        {item.maxQuantity === 0 && !r ? (
          // Sold out: nothing to adjust, only "Retirer".
          <View />
        ) : r ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onOpen} style={styles.link}>
            <Feather name="calendar" size={16} color={colors.brand.navy} />
            <AppText variant="secondaryStrong" color={colors.brand.navy}>
              Modifier les dates
            </AppText>
          </Pressable>
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
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  texts: { flex: 1, gap: 2 },
  flex: { flex: 1 },
  message: { flexDirection: 'row', gap: space.sm, padding: 10, borderRadius: radius.sm },
  blocking: { backgroundColor: colors.surface.neutral },
  info: { backgroundColor: colors.brand.orangeTint },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
});
