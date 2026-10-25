import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usingMock, type ProductSummary, type Universe } from '@/api';
import { mockSettings } from '@/api/mock/server';
import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FavouriteButton } from '@/components/FavouriteButton';
import { IconButton } from '@/components/IconButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Skeleton } from '@/components/Skeleton';
import { clearCart, useCartCount } from '@/data/cart';
import { clearFavourites, useFavourite, useFavouriteIds } from '@/data/favourites';
import { isForcedOffline, setForcedOffline, useOnline } from '@/data/online';
import { useCities, useProducts } from '@/data/queries';
import { queryPersister } from '@/data/queryClient';
import { colors, radius, space } from '@/theme';
import { formatFcfa, formatTime } from '@/utils/format';

type Latency = typeof mockSettings.latency;
type NextCheck = typeof mockSettings.nextCheck;

/**
 * Developer screen for Feature 3: products come from the mock API through the cache.
 * Switches simulate slow 3G, a server failure and no connection.
 */
export default function DonneesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const online = useOnline();
  const favourites = useFavouriteIds();

  const [universe, setUniverse] = useState<Universe | undefined>(undefined);
  const [latency, setLatency] = useState<Latency>(mockSettings.latency);
  const [failAll, setFailAll] = useState(mockSettings.failAll);
  const [forced, setForced] = useState(isForcedOffline());
  const [crash, setCrash] = useState(false);
  // "Simuler un plantage": throws while drawing, to check the crash screen.
  if (crash) throw new Error('Plantage simulé depuis l’écran Données (dev).');
  const [nextCheck, setNextCheck] = useState<NextCheck>(mockSettings.nextCheck);
  const cartCount = useCartCount();

  // The stock-check switch turns itself off after one use: re-read it when coming back here.
  useFocusEffect(useCallback(() => setNextCheck(mockSettings.nextCheck), []));
  const chooseNextCheck = (c: NextCheck) => {
    mockSettings.nextCheck = c;
    setNextCheck(c);
  };

  const products = useProducts({ universe, cityId: 'cocody' });
  const cities = useCities();
  const cityName = useMemo(
    () => new Map((cities.data ?? []).map((c) => [c.id, c.name])),
    [cities.data],
  );

  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  const total = products.data?.pages[0]?.total ?? 0;

  const chooseLatency = (l: Latency) => {
    mockSettings.latency = l;
    setLatency(l);
  };
  const toggleFail = () => {
    mockSettings.failAll = !mockSettings.failAll;
    setFailAll(mockSettings.failAll);
  };
  const toggleOffline = () => {
    setForcedOffline(!forced);
    setForced(!forced);
  };
  const clearCache = async () => {
    queryClient.clear();
    await queryPersister.removeClient();
    products.refetch();
  };

  return (
    <View style={styles.fill}>
      <Screen>
        <View style={styles.header}>
          <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={() => router.back()} />
          <AppText variant="headerTitle" accessibilityRole="header">
            Données (dev)
          </AppText>
        </View>

        {!online ? (
          <View style={styles.bleed}>
            <OfflineBanner savedAt={products.dataUpdatedAt ? formatTime(products.dataUpdatedAt) : undefined} />
          </View>
        ) : null}

        <SectionCard title="État">
          <Line label="Connexion" value={online ? 'En ligne' : 'Hors connexion'} />
          <Line label="Source" value={usingMock ? "Données d'exemple (mock)" : 'Passerelle'} />
          <Line
            label="Mis à jour"
            value={products.dataUpdatedAt ? formatTime(products.dataUpdatedAt) : '—'}
          />
          <Line label="Activité" value={products.isFetching ? 'Actualisation…' : 'Au repos'} />
          <Line label="Favoris enregistrés" value={String(favourites.size)} />
          <Line label="Articles au panier" value={String(cartCount)} />
        </SectionCard>

        <SectionCard title="Simulations">
          <AppText variant="caption" color={colors.text.muted}>
            RÉSEAU
          </AppText>
          <View style={styles.chips}>
            <Chip label="Rapide" active={latency === 'fast'} onPress={() => chooseLatency('fast')} />
            <Chip label="Normal" active={latency === 'normal'} onPress={() => chooseLatency('normal')} />
            <Chip label="Lent (3G)" active={latency === 'slow'} onPress={() => chooseLatency('slow')} />
          </View>
          <View style={styles.chips}>
            <Chip label="Panne serveur" icon="alert-triangle" active={failAll} onPress={toggleFail} />
            <Chip label="Hors connexion" icon="wifi-off" active={forced} onPress={toggleOffline} />
          </View>
          <View style={styles.row}>
            <Button label="Actualiser" variant="outline" icon="refresh-cw" onPress={() => products.refetch()} style={styles.grow} />
            <Button label="Vider le cache" variant="outline" icon="trash-2" onPress={clearCache} style={styles.grow} />
          </View>
          {favourites.size > 0 ? (
            <Button label="Effacer les favoris" variant="outline" icon="heart" onPress={clearFavourites} />
          ) : null}
          {cartCount > 0 ? (
            <Button label="Vider le panier" variant="outline" icon="shopping-cart" onPress={clearCart} />
          ) : null}

          <Button label="Simuler un plantage" variant="outline" icon="zap" onPress={() => setCrash(true)} />

          <AppText variant="caption" color={colors.text.muted}>
            PROCHAIN CONTRÔLE STOCK / DISPONIBILITÉ (UNE SEULE FOIS)
          </AppText>
          <View style={styles.chips}>
            <Chip label="Normal" active={nextCheck === 'normal'} onPress={() => chooseNextCheck('normal')} />
            <Chip label="Épuisé / dates prises" active={nextCheck === 'sold_out'} onPress={() => chooseNextCheck('sold_out')} />
            <Chip label="Prix + 1 000" active={nextCheck === 'price_up'} onPress={() => chooseNextCheck('price_up')} />
          </View>
        </SectionCard>

        <View style={styles.chips}>
          <Chip label="Tout" active={!universe} onPress={() => setUniverse(undefined)} />
          <Chip label="Vente" active={universe === 'vente'} onPress={() => setUniverse('vente')} />
          <Chip label="Location" active={universe === 'location'} onPress={() => setUniverse('location')} />
        </View>

        {products.isPending ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <RowSkeleton key={i} />
            ))}
          </View>
        ) : products.isError && items.length === 0 ? (
          <SectionCard>
            <EmptyState
              icon="alert-triangle"
              title="Impossible de charger les annonces"
              message={products.error.message}
              actionLabel="Réessayer"
              onAction={() => products.refetch()}
            />
          </SectionCard>
        ) : (
          <View style={styles.list}>
            <AppText variant="meta" color={colors.text.muted}>
              {`${total} annonce${total > 1 ? 's' : ''} · Cocody en premier`}
            </AppText>
            {items.map((p) => (
              <Row key={p.id} item={p} city={cityName.get(p.cityId) ?? ''} />
            ))}
            {products.hasNextPage ? (
              <Button
                label="Voir plus"
                variant="outline"
                loading={products.isFetchingNextPage}
                onPress={() => products.fetchNextPage()}
              />
            ) : null}
          </View>
        )}
      </Screen>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="meta" color={colors.text.muted}>
        {label}
      </AppText>
      <AppText variant="metaStrong">{value}</AppText>
    </View>
  );
}

function Row({ item, city }: { item: ProductSummary; city: string }) {
  const [saved, toggle] = useFavourite(item.id);
  const rental = item.universe === 'location';
  return (
    <View style={styles.row2}>
      <View style={[styles.thumb, { backgroundColor: rental ? colors.brand.orangeTint : colors.brand.navyTint }]} />
      <View style={styles.texts}>
        <AppText variant="secondaryStrong" numberOfLines={2}>
          {item.name}
        </AppText>
        <AppText variant="bodyStrong">
          {formatFcfa(item.price)}
          {rental ? <AppText variant="caption" color={colors.text.muted}>{' / jour'}</AppText> : null}
        </AppText>
        <AppText variant="caption" color={colors.text.muted} numberOfLines={1}>
          {`${city} · ${item.shopName}`}
        </AppText>
        {item.stockStatus === 'out_of_stock' ? (
          <Tag label="Épuisé" tone="neutral" />
        ) : item.stockStatus === 'low_stock' ? (
          <Tag label="Plus que quelques-uns" tone="orange" />
        ) : rental ? (
          <Tag label="Location" />
        ) : (
          <Tag label="En stock" tone="green" />
        )}
      </View>
      <FavouriteButton saved={saved} onToggle={toggle} small style={styles.heart} />
    </View>
  );
}

function RowSkeleton() {
  return (
    <View style={styles.row2}>
      <Skeleton width={80} height={80} />
      <View style={[styles.texts, { gap: space.sm }]}>
        <Skeleton height={14} width="85%" />
        <Skeleton height={16} width="45%" />
        <Skeleton height={12} width="60%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md },
  bleed: { marginHorizontal: -space.gutter },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  grow: { flex: 1 },
  list: { gap: space.md },
  row2: {
    flexDirection: 'row',
    gap: space.md,
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.card,
  },
  thumb: { width: 80, height: 80, borderRadius: radius.sm },
  texts: { flex: 1, gap: space.xs },
  heart: { borderWidth: 1, borderColor: colors.border.default },
});
