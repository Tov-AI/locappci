import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProductSummary, SortOrder, Universe } from '@/api';
import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { EmptyState } from '@/components/EmptyState';
import { NoConnection } from '@/components/NoConnection';
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  FiltersSheet,
  SORT_LABELS,
  type Filters,
} from '@/components/FiltersSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductRow, ProductRowSkeleton } from '@/components/ProductRow';
import { useCity } from '@/data/city';
import { useOnline } from '@/data/online';
import { useCategories, useCities, useProducts, waitingForNetwork } from '@/data/queries';
import { addRecentSearch, clearRecentSearches, useRecentSearches } from '@/data/recentSearches';
import { colors, fontFamily, radius, space } from '@/theme';
import { formatTime } from '@/utils/format';

const DEBOUNCE_MS = 300;
/** The "Affiner par catégorie" box appears after this many results. */
const REFINE_AFTER = 2;

type Params = { universe?: Universe; sort?: SortOrder; focus?: string; t?: string };

/**
 * Recherche: one place to find anything in Vente and Location.
 * Opened from the tab bar, the Accueil search bar, the universe cards and "Tout voir".
 */
export default function RechercheScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const online = useOnline();
  const city = useCity();
  const cityId = city || undefined;
  const cities = useCities();
  const categories = useCategories();
  const recents = useRecentSearches();

  const inputRef = useRef<TextInputInstance>(null);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  // Accueil opens this tab with a universe, a sort, or "focus" (from its search bar).
  // `t` changes on every tap, so the same card tapped twice still applies.
  useEffect(() => {
    if (params.universe || params.sort) {
      setFilters((f) => ({ ...f, universe: params.universe ?? f.universe, sort: params.sort ?? f.sort }));
      setCategoryId(undefined);
    }
    if (params.focus) setTimeout(() => inputRef.current?.focus(), 250);
  }, [params.universe, params.sort, params.focus, params.t]);

  // Search 300 ms after typing stops, not on every key.
  useEffect(() => {
    const id = setTimeout(() => setSearch(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);

  const query = { ...filters, search: search || undefined, cityId, categoryId };
  const products = useProducts(query);
  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  const total = products.data?.pages[0]?.total ?? 0;

  const cityNames = useMemo(() => new Map((cities.data ?? []).map((c) => [c.id, c.name])), [cities.data]);
  const categoryNames = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );
  const cityName = cityId ? cityNames.get(cityId) : undefined;

  // Suggest the categories found in the results (at most 4), Jiji-style.
  const refine = useMemo(() => {
    if (categoryId) return [];
    const seen = [...new Set(items.map((i) => i.categoryId))];
    return seen.filter((id) => categoryNames.has(id)).slice(0, 4);
  }, [items, categoryId, categoryNames]);

  const activeCount = countActiveFilters(filters);
  const hasAnyFilter = activeCount > 0 || !!categoryId || !!search;
  const showRecents = text.length === 0 && recents.length > 0;

  const clearAll = () => {
    setText('');
    setSearch('');
    setFilters(DEFAULT_FILTERS);
    setCategoryId(undefined);
  };

  const openProduct = (item: ProductSummary) => {
    if (search) addRecentSearch(search);
    router.push({ pathname: '/produit/[id]', params: { id: item.id } });
  };

  const typeLabel = filters.universe === 'vente' ? 'Vente' : filters.universe === 'location' ? 'Location' : 'Vente et location';

  // Build list rows: products, with the refine box after the 2nd one.
  type Row = { kind: 'product'; item: ProductSummary } | { kind: 'refine' };
  const rows: Row[] = items.map((item) => ({ kind: 'product' as const, item }));
  if (refine.length > 1 && rows.length > REFINE_AFTER) rows.splice(REFINE_AFTER, 0, { kind: 'refine' });

  const showError = products.isError && items.length === 0;

  return (
    <View style={styles.fill}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.text.muted} />
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => addRecentSearch(text)}
            placeholder="Rechercher un produit, un matériel…"
            placeholderTextColor={colors.text.placeholder}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Rechercher"
            style={styles.input}
          />
          {text ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" hitSlop={10} onPress={() => setText('')}>
              <Feather name="x-circle" size={18} color={colors.text.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip
            label={activeCount ? `Filtres · ${activeCount}` : 'Filtres'}
            icon="sliders"
            active
            onPress={() => setSheetOpen(true)}
          />
          <Chip label={typeLabel} onPress={() => setSheetOpen(true)} />
          <Chip label={cityName ?? "Toute la Côte d'Ivoire"} icon="map-pin" onPress={() => setCityOpen(true)} />
          <Chip label={SORT_LABELS[filters.sort]} onPress={() => setSheetOpen(true)} />
          {categoryId ? (
            <Chip
              label={`${categoryNames.get(categoryId) ?? 'Catégorie'}  ✕`}
              active
              onPress={() => setCategoryId(undefined)}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {!online ? (
        <OfflineBanner savedAt={products.dataUpdatedAt ? formatTime(products.dataUpdatedAt) : undefined} />
      ) : null}

      <FlatList
        data={products.isPending || showError ? [] : rows}
        keyExtractor={(row, i) => (row.kind === 'product' ? row.item.id : `refine-${i}`)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {showRecents ? (
              <View style={styles.recents}>
                <View style={styles.between}>
                  <AppText variant="metaStrong" color={colors.text.muted}>
                    Recherches récentes
                  </AppText>
                  <Pressable accessibilityRole="button" hitSlop={10} onPress={clearRecentSearches}>
                    <AppText variant="metaStrong" color={colors.brand.navy}>
                      Effacer
                    </AppText>
                  </Pressable>
                </View>
                <View style={styles.wrap}>
                  {recents.map((r) => (
                    <Chip key={r} label={r} icon="clock" onPress={() => setText(r)} />
                  ))}
                </View>
              </View>
            ) : null}
            {products.isPending || showError ? null : (
              <AppText variant="meta" color={colors.text.muted} accessibilityLiveRegion="polite">
                {`${total} résultat${total > 1 ? 's' : ''}${cityName ? ` près de ${cityName}` : ''}${!online ? ' · hors connexion' : ''}`}
              </AppText>
            )}
          </View>
        }
        renderItem={({ item: row }) =>
          row.kind === 'refine' ? (
            <View style={styles.refine}>
              <AppText variant="metaStrong" color={colors.brand.navyDark}>
                Affiner par catégorie
              </AppText>
              <View style={styles.wrap}>
                {refine.map((id) => (
                  <Chip key={id} label={categoryNames.get(id) ?? id} onPress={() => setCategoryId(id)} />
                ))}
              </View>
            </View>
          ) : (
            <ProductRow item={row.item} cityName={cityNames.get(row.item.cityId) ?? ''} onPress={() => openProduct(row.item)} />
          )
        }
        ListEmptyComponent={
          waitingForNetwork(products) ? (
            <NoConnection what="les résultats" onRetry={() => products.refetch()} />
          ) : products.isPending ? (
            <View style={styles.list}>
              {[0, 1, 2].map((i) => (
                <ProductRowSkeleton key={i} />
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
              icon="search"
              title={search ? `Aucun résultat pour « ${search} »` : 'Aucun résultat'}
              message="Essayez un autre mot ou retirez des filtres."
              actionLabel={hasAnyFilter ? 'Effacer les filtres' : undefined}
              onAction={hasAnyFilter ? clearAll : undefined}
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

      <FiltersSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={filters}
        onApply={setFilters}
        search={search || undefined}
        cityId={cityId}
        categoryId={categoryId}
      />
      <CityPickerSheet visible={cityOpen} onClose={() => setCityOpen(false)} selected={city} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  header: {
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: space.md,
  },
  search: {
    marginHorizontal: space.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface.field,
  },
  input: {
    flex: 1,
    minHeight: 48,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text.primary,
  },
  chips: { paddingHorizontal: space.gutter, gap: space.sm },
  content: { padding: space.gutter, paddingBottom: space.xxl * 2, gap: 10 },
  listHeader: { gap: space.lg },
  recents: { gap: space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: 10 },
  refine: { gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.brand.navyTint },
  more: { paddingVertical: space.lg },
});
