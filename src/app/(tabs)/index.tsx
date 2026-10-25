import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProductSummary, Universe } from '@/api';
import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { useCity } from '@/data/city';
import { useOnline } from '@/data/online';
import { useCities, useProducts } from '@/data/queries';
import { colors, radius, size, space } from '@/theme';
import { formatTime } from '@/utils/format';

const COMING_SOON = ['Services', 'Immobilier', 'Emploi', '+ 4 univers'];

/**
 * With an odd number of products, the last card would stretch across the whole row.
 * An invisible spacer fills the empty half so every card keeps the same width.
 */
const SPACER_ID = '__spacer__';
function padToEvenRow(items: ProductSummary[]): ProductSummary[] {
  if (items.length % 2 === 0) return items;
  return [...items, { ...items[0], id: SPACER_ID }];
}

/**
 * Accueil: get the user into Vente or Location in one tap.
 * Loads from the phone's cache first, then refreshes in the background.
 */
export default function AccueilScreen() {
  const router = useRouter();
  const online = useOnline();
  const city = useCity();
  const cities = useCities();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Ask "Où êtes-vous ?" once, on first launch only.
  const firstLaunch = city === null;
  useEffect(() => {
    if (firstLaunch) setPickerOpen(true);
  }, [firstLaunch]);

  const cityId = city || undefined;
  const products = useProducts({ cityId, sort: 'nearest' });
  const items = products.data?.pages.flatMap((p) => p.items) ?? [];

  const cityNames = useMemo(
    () => new Map((cities.data ?? []).map((c) => [c.id, c.name])),
    [cities.data],
  );
  const chosen = cities.data?.find((c) => c.id === cityId);
  const cityLabel = chosen ? `${chosen.name}, ${chosen.region}` : "Toute la Côte d'Ivoire";

  const openUniverse = (universe: Universe) =>
    router.push({ pathname: '/recherche', params: { universe } });

  const openProduct = (item: ProductSummary) =>
    router.push({ pathname: '/produit/[id]', params: { id: item.id } });

  const header = (
    <View style={styles.listHeader}>
      <View style={styles.universes}>
        <UniverseCard
          title="Vente"
          subtitle="Produits et boutiques près de vous"
          icon="shopping-bag"
          variant="navy"
          onPress={() => openUniverse('vente')}
        />
        <UniverseCard
          title="Location"
          subtitle="Matériel et équipements à louer"
          icon="briefcase"
          variant="orange"
          onPress={() => openUniverse('location')}
        />
      </View>

      <View style={styles.soon}>
        <AppText variant="metaStrong" color={colors.text.muted}>
          Bientôt dans l'appli
        </AppText>
        <View style={styles.chips}>
          {COMING_SOON.map((label) => (
            <Chip key={label} label={label} muted />
          ))}
        </View>
      </View>

      <View style={styles.sectionTitle}>
        <AppText variant="headerTitle" accessibilityRole="header">
          Près de chez vous
        </AppText>
        <Pressable
          accessibilityRole="link"
          hitSlop={12}
          onPress={() => router.push({ pathname: '/recherche', params: { sort: 'nearest' } })}>
          <AppText variant="secondaryStrong" color={colors.brand.navy}>
            Tout voir
          </AppText>
        </Pressable>
      </View>
    </View>
  );

  const showError = products.isError && items.length === 0;

  return (
    <View style={styles.fill}>
      {/* Fixed white header: brand, commune, notifications, search entry. */}
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.brand}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <AppText variant="display" color={colors.brand.navy} accessibilityRole="header">
                LOCAPPCI
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Commune : ${cityLabel}. Changer`}
              onPress={() => setPickerOpen(true)}
              hitSlop={8}
              style={styles.cityChip}>
              <Feather name="map-pin" size={14} color={colors.brand.navy} />
              <AppText variant="metaStrong" color={colors.text.muted} numberOfLines={1}>
                {cityLabel}
              </AppText>
              <Feather name="chevron-down" size={14} color={colors.text.muted} />
            </Pressable>
          </View>
          {/* Notifications screen is designed in a later feature. */}
          <IconButton icon="bell" accessibilityLabel="Notifications" bordered />
        </View>

        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Rechercher un produit ou un matériel"
          onPress={() => router.push('/recherche')}
          style={({ pressed }) => [styles.search, pressed && styles.searchPressed]}>
          <Feather name="search" size={18} color={colors.text.muted} />
          <AppText variant="body" color={colors.text.placeholder}>
            Rechercher un produit, un matériel…
          </AppText>
        </Pressable>
      </SafeAreaView>

      {!online ? (
        <OfflineBanner savedAt={products.dataUpdatedAt ? formatTime(products.dataUpdatedAt) : undefined} />
      ) : null}

      <FlatList
        data={products.isPending || showError ? [] : padToEvenRow(items)}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.id === SPACER_ID ? (
            <View style={styles.spacer} />
          ) : (
            <ProductCard
              item={item}
              cityName={cityNames.get(item.cityId) ?? ''}
              onPress={() => openProduct(item)}
            />
          )
        }
        ListEmptyComponent={
          products.isPending ? (
            <View style={styles.skeletons}>
              {[0, 1].map((r) => (
                <View key={r} style={styles.row}>
                  <ProductCardSkeleton />
                  <ProductCardSkeleton />
                </View>
              ))}
            </View>
          ) : showError ? (
            <EmptyState
              icon="alert-triangle"
              title="Impossible de charger les annonces"
              message={products.error?.message ?? 'Réessayez dans un instant.'}
              actionLabel="Réessayer"
              onAction={() => products.refetch()}
            />
          ) : (
            <EmptyState
              icon="map-pin"
              title="Rien près de chez vous pour l'instant"
              message="Essayez une autre commune ou toute la Côte d'Ivoire."
              actionLabel="Changer de ville"
              onAction={() => setPickerOpen(true)}
            />
          )
        }
        onEndReached={() => {
          if (products.hasNextPage && !products.isFetchingNextPage) products.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          products.isFetchingNextPage ? <ActivityIndicator color={colors.brand.navy} style={styles.more} /> : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={products.isRefetching && !products.isFetchingNextPage}
            onRefresh={() => {
              products.refetch();
            }}
            colors={[colors.brand.navy]}
            tintColor={colors.brand.navy}
          />
        }
      />

      <CityPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={city}
        firstLaunch={firstLaunch}
      />
    </View>
  );
}

type UniverseCardProps = {
  title: string;
  subtitle: string;
  icon: 'shopping-bag' | 'briefcase';
  variant: 'navy' | 'orange';
  onPress: () => void;
};

function UniverseCard({ title, subtitle, icon, variant, onPress }: UniverseCardProps) {
  const navy = variant === 'navy';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.universe,
        { backgroundColor: navy ? colors.brand.navy : colors.brand.orangeTint },
        pressed && styles.universePressed,
      ]}>
      <View style={[styles.universeIcon, { backgroundColor: navy ? colors.brand.onNavyTile : colors.surface.card }]}>
        <Feather name={icon} size={22} color={navy ? colors.text.inverse : colors.brand.orangeText} />
      </View>
      <AppText variant="cardTitle" color={navy ? colors.text.inverse : colors.text.primary}>
        {title}
      </AppText>
      <AppText variant="meta" color={navy ? colors.brand.onNavyMuted : colors.brand.orangeTextDark}>
        {subtitle}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  headerWrap: {
    backgroundColor: colors.surface.card,
    paddingHorizontal: space.gutter,
    paddingBottom: space.lg,
    gap: space.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.md,
    gap: space.md,
  },
  headerLeft: { flex: 1, gap: space.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logo: { width: 26, height: 36 },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 28 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface.field,
  },
  searchPressed: { backgroundColor: colors.surface.neutral },
  content: { padding: space.gutter, paddingBottom: space.xxl * 2, gap: space.md },
  listHeader: { gap: space.xl, marginBottom: space.xs },
  universes: { flexDirection: 'row', gap: space.md },
  universe: { flex: 1, padding: space.lg, borderRadius: radius.xl, gap: 10, minHeight: size.touch },
  universePressed: { opacity: 0.9 },
  universeIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  soon: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: { gap: space.md },
  skeletons: { gap: space.md },
  more: { paddingVertical: space.lg },
  spacer: { flex: 1 },
});
