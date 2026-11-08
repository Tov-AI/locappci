import { StyleSheet, View } from 'react-native';

import type { Shop } from '@/api';
import { AppText } from '@/components/AppText';
import { Skeleton } from '@/components/Skeleton';
import { colors, size, space } from '@/theme';

type Props = {
  shop?: Shop;
  loading: boolean;
  /** Commune of the shop. */
  cityName?: string;
};

/** Shop initials, name and "Vendeur · Commune" (or "Loueur"), between two thin lines. */
export function SellerRow({ shop, loading, cityName }: Props) {
  if (loading) {
    return (
      <View style={styles.row}>
        <Skeleton width={size.touch} height={size.touch} borderRadius={size.touch / 2} />
        <View style={[styles.texts, { gap: space.sm }]}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={12} width="40%" />
        </View>
      </View>
    );
  }
  if (!shop) return null; // Shop could not load: the rest of the page still works.
  const role = shop.role === 'loueur' ? 'Loueur' : 'Vendeur';
  return (
    <View style={styles.row} accessible accessibilityLabel={`${role} : ${shop.name}${cityName ? `, ${cityName}` : ''}`}>
      <View style={styles.avatar}>
        <AppText variant="secondaryStrong" color={colors.brand.navyDark}>
          {shop.initials}
        </AppText>
      </View>
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {shop.name}
        </AppText>
        <AppText variant="meta" color={colors.text.muted}>
          {[role, cityName].filter(Boolean).join(' · ')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.default,
  },
  texts: { flex: 1 },
  avatar: {
    width: size.touch,
    height: size.touch,
    borderRadius: size.touch / 2,
    backgroundColor: colors.brand.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
