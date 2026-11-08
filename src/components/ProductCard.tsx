import Feather from '@expo/vector-icons/Feather';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import type { ProductSummary } from '@/api';
import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { FavouriteButton } from '@/components/FavouriteButton';
import { Skeleton } from '@/components/Skeleton';
import { useFavourite } from '@/data/favourites';
import { colors, fontFamily, radius, space } from '@/theme';
import { formatFcfa } from '@/utils/format';

const PHOTO_HEIGHT = 140;

type Props = {
  item: ProductSummary;
  /** Commune name shown under the price. */
  cityName: string;
  onPress: () => void;
};

/**
 * Grid card from the handoff: photo 140 high, heart top right,
 * "Location" tag top left for rentals, name 14/500, price 15/700, commune 12.
 */
export function ProductCard({ item, cityName, onPress }: Props) {
  const [saved, toggle] = useFavourite(item.id);
  const rental = item.universe === 'location';
  const soldOut = item.stockStatus === 'out_of_stock';
  const price = formatFcfa(item.price);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${price}${rental ? ' par jour' : ''}, ${cityName}${soldOut ? ', épuisé' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.photo, { backgroundColor: rental ? colors.brand.orangeTint : colors.brand.navyTint }]}>
        {/* Stays visible if the photo is missing or fails to load. */}
        <Feather name="image" size={36} color={rental ? colors.brand.orangeBorder : colors.brand.navyMuted} />
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        {rental ? <Tag label="Location" style={styles.tag} /> : null}
        {soldOut ? <Tag label="Épuisé" tone="neutral" style={styles.tag} /> : null}
        <FavouriteButton saved={saved} onToggle={toggle} small style={styles.heart} />
      </View>

      <View style={styles.body}>
        <AppText variant="secondary" numberOfLines={2}>
          {item.name}
        </AppText>
        <AppText variant="bodyStrong" style={styles.price}>
          {price}
          {rental ? (
            <AppText variant="caption" color={colors.text.muted}>
              {' / jour'}
            </AppText>
          ) : null}
        </AppText>
        <AppText variant="caption" color={colors.text.muted} numberOfLines={1}>
          {cityName}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Same shape as ProductCard, shown while the list loads with no cache. */
export function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={PHOTO_HEIGHT} borderRadius={0} />
      <View style={[styles.body, { gap: space.sm }]}>
        <Skeleton height={13} width="90%" />
        <Skeleton height={15} width="55%" />
        <Skeleton height={11} width="40%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  photo: { height: PHOTO_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  tag: { position: 'absolute', top: space.sm, left: space.sm },
  heart: { position: 'absolute', top: space.sm, right: space.sm },
  body: { padding: space.md, paddingTop: 10, gap: space.xs },
  price: { fontFamily: fontFamily.bold },
});
