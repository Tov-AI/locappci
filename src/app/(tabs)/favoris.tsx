import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProductSummary } from '@/api';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { NoConnection } from '@/components/NoConnection';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { useFavouriteIds } from '@/data/favourites';
import { useOnline } from '@/data/online';
import { useCities, useFavouriteProducts, waitingForNetwork } from '@/data/queries';
import { colors, space } from '@/theme';
import { formatTime } from '@/utils/format';

const SPACER_ID = '__spacer__';

/**
 * Favoris: products saved with the heart, newest first, also offline (saved list + cached products).
 * Removing the heart takes the card away at once.
 */
export default function FavorisScreen() {
  const router = useRouter();
  const online = useOnline();
  const saved = useFavouriteIds();
  // Newest first: the Set keeps insertion order, so reverse it.
  const ids = useMemo(() => [...saved].reverse(), [saved]);
  const products = useFavouriteProducts(ids);
  const cities = useCities();
  const cityNames = useMemo(() => new Map((cities.data ?? []).map((c) => [c.id, c.name])), [cities.data]);

  // Hide at once a card whose heart was just removed (the list reloads in the background).
  const items = (products.data ?? []).filter((p) => saved.has(p.id));
  const data: ProductSummary[] = items.length % 2 === 0 ? items : [...items, { ...items[0], id: SPACER_ID }];
  const loading = ids.length > 0 && products.isPending;
  const noNetwork = ids.length > 0 && waitingForNetwork(products);

  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <View style={styles.header}>
        <AppText variant="screenTitle" accessibilityRole="header">
          Favoris
        </AppText>
        {ids.length > 0 ? (
          <AppText variant="meta" color={colors.text.muted}>
            {`${ids.length} annonce${ids.length > 1 ? 's' : ''}`}
          </AppText>
        ) : null}
      </View>
      {!online && ids.length > 0 ? (
        <OfflineBanner savedAt={products.dataUpdatedAt ? formatTime(products.dataUpdatedAt) : undefined} />
      ) : null}

      {ids.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Aucun favori pour l’instant"
          message="Touchez le cœur sur une annonce pour la retrouver ici, même hors connexion."
          actionLabel="Découvrir les annonces"
          onAction={() => router.navigate('/')}
        />
      ) : noNetwork ? (
        <NoConnection what="vos favoris" onRetry={() => products.refetch()} />
      ) : loading ? (
        <View style={[styles.content, styles.row]}>
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </View>
      ) : products.isError && items.length === 0 ? (
        <EmptyState
          icon="alert-triangle"
          title="Impossible de charger vos favoris"
          message={products.error.message}
          actionLabel="Réessayer"
          onAction={() => products.refetch()}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.content}
          renderItem={({ item }) =>
            item.id === SPACER_ID ? (
              <View style={styles.spacer} />
            ) : (
              <ProductCard
                item={item}
                cityName={cityNames.get(item.cityId) ?? ''}
                onPress={() => router.push({ pathname: '/produit/[id]', params: { id: item.id } })}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={products.isRefetching}
              onRefresh={() => {
                products.refetch();
              }}
              colors={[colors.brand.navy]}
              tintColor={colors.brand.navy}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  content: { padding: space.gutter, paddingTop: 0, paddingBottom: space.xxl * 2, gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  spacer: { flex: 1 },
});
