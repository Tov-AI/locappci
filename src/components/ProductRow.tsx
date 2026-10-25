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

const THUMB = 92;

type Props = {
  item: ProductSummary;
  cityName: string;
  onPress: () => void;
};

/** Full-width result row: 92 × 92 photo, name, price, commune · shop, stock line. */
export function ProductRow({ item, cityName, onPress }: Props) {
  const [saved, toggle] = useFavourite(item.id);
  const rental = item.universe === 'location';
  const price = formatFcfa(item.price);
  const place = [cityName, item.shopName].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${price}${rental ? ' par jour' : ''}, ${place}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.thumb, { backgroundColor: rental ? colors.brand.orangeTint : colors.brand.navyTint }]}>
        {/* Stays visible if the photo is missing or fails to load. */}
        <Feather name="image" size={26} color={rental ? colors.brand.orangeBorder : colors.brand.navyMuted} />
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
      </View>

      <View style={styles.texts}>
        <AppText variant="secondaryStrong" numberOfLines={2}>
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
          {place}
        </AppText>
        <StockLine item={item} />
      </View>

      <FavouriteButton saved={saved} onToggle={toggle} small style={styles.heart} />
    </Pressable>
  );
}

function StockLine({ item }: { item: ProductSummary }) {
  if (item.universe === 'location') return <Tag label="Location" />;
  if (item.stockStatus === 'out_of_stock') return <Tag label="Épuisé" tone="neutral" />;
  if (item.stockStatus === 'low_stock') return <Tag label="Plus que quelques-uns" />;
  return <Tag label="En stock" tone="green" />;
}

export function ProductRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={THUMB} height={THUMB} />
      <View style={[styles.texts, { gap: space.sm }]}>
        <Skeleton height={14} width="85%" />
        <Skeleton height={16} width="45%" />
        <Skeleton height={12} width="60%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.card,
  },
  pressed: { opacity: 0.85 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: space.xs },
  price: { fontFamily: fontFamily.bold },
  heart: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border.default },
});
