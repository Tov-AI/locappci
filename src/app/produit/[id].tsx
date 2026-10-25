import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, type RentalProduct, type SaleProduct, type Shop } from '@/api';
import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { BottomActionBar } from '@/components/BottomActionBar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FavouriteButton } from '@/components/FavouriteButton';
import { IconButton } from '@/components/IconButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PHOTO_HEIGHT, PhotoCarousel } from '@/components/PhotoCarousel';
import { ProductCard } from '@/components/ProductCard';
import { ReportSheet } from '@/components/ReportSheet';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Skeleton } from '@/components/Skeleton';
import { showToast } from '@/components/Toast';
import { addToCart, useCartQuantity } from '@/data/cart';
import { useFavourite } from '@/data/favourites';
import { useOnline } from '@/data/online';
import {
  keys,
  useCategories,
  useCities,
  useProduct,
  useShop,
  useSimilarProducts,
  useStockCheck,
} from '@/data/queries';
import { colors, fontFamily, radius, size, space } from '@/theme';
import { formatFcfa, formatTime } from '@/utils/format';

/** Descriptions longer than this start folded, with "Lire la suite". */
const FOLD_AFTER_CHARS = 220;
const FOLDED_LINES = 5;
const SIMILAR_CARD_WIDTH = 168;

/**
 * Produit (Feature 6): one product for sale.
 * Rentals still open the temporary view below until Location détail (Feature 7).
 */
/** Back to the previous screen; to Accueil when the screen was opened from a link with no history. */
function useGoBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

export default function ProduitScreen() {
  const goBack = useGoBack();
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const p = product.data;

  if (product.isPending) return <ProduitSkeleton onBack={goBack} />;

  if (!p) {
    const gone = product.error instanceof ApiError && product.error.code === 'not_found';
    return (
      <Screen>
        <View style={styles.plainHeader}>
          <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={goBack} />
        </View>
        <EmptyState
          icon={gone ? 'slash' : 'alert-triangle'}
          title={gone ? "Cette annonce n'est plus disponible" : "Impossible de charger l'annonce"}
          message={gone ? 'Le vendeur l’a retirée ou elle a été vendue.' : product.error?.message ?? ''}
          actionLabel={gone ? 'Retour' : 'Réessayer'}
          onAction={gone ? goBack : () => product.refetch()}
        />
      </Screen>
    );
  }

  if (p.universe === 'location') return <RentalPreview product={p} onBack={goBack} />;
  return <SaleDetail product={p} savedAt={product.dataUpdatedAt} />;
}

function SaleDetail({ product: p, savedAt }: { product: SaleProduct; savedAt: number }) {
  const router = useRouter();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const online = useOnline();
  const shop = useShop(p.shopId);
  const cities = useCities();
  const categories = useCategories();
  const similar = useSimilarProducts(p.id, p.universe, p.categoryId);
  const stockCheck = useStockCheck();
  const [saved, toggleSaved] = useFavourite(p.id);
  const inCart = useCartQuantity(p.id);
  const [expanded, setExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const cityNames = useMemo(() => new Map((cities.data ?? []).map((c) => [c.id, c.name])), [cities.data]);
  const categoryName = categories.data?.find((c) => c.id === p.categoryId)?.name;
  const cityName = cityNames.get(p.cityId);
  const price = formatFcfa(p.price);
  const soldOut = p.stock.status === 'out_of_stock';
  const foldable = p.description.length > FOLD_AFTER_CHARS;

  const share = () => {
    Share.share({ message: `${p.name} – ${price}\n${p.webUrl}` }).catch(() => {
      // The person closed the share menu or no app could share: nothing to do.
    });
  };

  const openWhatsApp = (s: Shop) => {
    const text =
      `Bonjour ${s.name}, je suis intéressé(e) par « ${p.name} » à ${price} sur LOCAPPCI. ` +
      `Est-il toujours disponible ?\n${p.webUrl}`;
    Linking.openURL(`https://wa.me/${s.whatsapp}?text=${encodeURIComponent(text)}`).catch(() =>
      showToast("Impossible d'ouvrir WhatsApp sur ce téléphone."),
    );
  };

  const add = () => {
    if (!online) {
      showToast('Connexion nécessaire pour vérifier le stock avant l’ajout.');
      return;
    }
    stockCheck.mutate(
      { productId: p.id, shownPrice: p.price },
      {
        onSuccess: async (check) => {
          // Trust the live answer straight away: update this screen's copy of the product.
          queryClient.setQueryData<SaleProduct>(keys.product(p.id), (old) =>
            old
              ? {
                  ...old,
                  price: check.price,
                  stock: {
                    status: check.status,
                    quantity: check.available ? old.stock.quantity : 0,
                  },
                }
              : old,
          );

          if (!check.available) {
            showToast('Désolé, ce produit vient d’être épuisé.');
            return;
          }

          // The shop name may still be loading if the person tapped very fast.
          const shopName =
            shop.data?.name ??
            (await queryClient
              .ensureQueryData({ queryKey: keys.shop(p.shopId), queryFn: () => api.getShop(p.shopId) })
              .then((s) => s.name)
              .catch(() => ''));

          const result = addToCart({
            productId: p.id,
            name: p.name,
            price: check.price,
            coverUrl: p.images[0] ?? null,
            shopId: p.shopId,
            shopName,
            maxQuantity: p.stock.quantity,
          });

          const priceNote = check.priceChanged ? `Le prix a changé : ${formatFcfa(check.price)}. ` : '';
          const message =
            result.outcome === 'added'
              ? 'Ajouté au panier.'
              : result.outcome === 'increased'
                ? `Ajouté au panier (${result.quantity} au total).`
                : `Vous avez déjà tout le stock disponible (${result.quantity}) dans votre panier.`;
          showToast(priceNote + message, { label: 'Voir le panier', onPress: () => router.dismissTo('/panier') });
        },
        onError: (error) => showToast(error.message),
      },
    );
  };

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <PhotoCarousel images={p.images} name={p.name} />
          <View style={[styles.photoButtons, { top: insets.top + space.sm }]} pointerEvents="box-none">
            <IconButton icon="arrow-left" accessibilityLabel="Retour" onPress={goBack} />
            <View style={styles.row}>
              <IconButton icon="share-2" accessibilityLabel="Partager" onPress={share} />
              <FavouriteButton saved={saved} onToggle={toggleSaved} />
            </View>
          </View>
        </View>

        {!online ? <OfflineBanner savedAt={savedAt ? formatTime(savedAt) : undefined} /> : null}

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            {categoryName ? (
              <AppText variant="caption" color={colors.text.muted}>
                {categoryName}
              </AppText>
            ) : null}
            <AppText variant="productTitle" accessibilityRole="header">
              {p.name}
            </AppText>
            <AppText variant="display" color={colors.brand.navy}>
              {price}
            </AppText>
            <View style={[styles.row, styles.wrapRow]}>
              <StockTag product={p} />
              {cityName ? (
                <View style={styles.row}>
                  <Feather name="map-pin" size={14} color={colors.text.muted} />
                  <AppText variant="meta" color={colors.text.muted}>
                    {cityName}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>

          <SellerRow shop={shop.data} loading={shop.isPending} cityName={shop.data ? cityNames.get(shop.data.cityId) : undefined} />

          <View style={styles.section}>
            <AppText variant="cardTitle" accessibilityRole="header">
              Description
            </AppText>
            <AppText
              variant="body"
              color={colors.text.body}
              numberOfLines={foldable && !expanded ? FOLDED_LINES : undefined}>
              {p.description}
            </AppText>
            {foldable ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setExpanded((e) => !e)}
                style={styles.linkRow}>
                <AppText variant="secondaryStrong" color={colors.brand.navy}>
                  {expanded ? 'Réduire' : 'Lire la suite'}
                </AppText>
                <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.brand.navy} />
              </Pressable>
            ) : null}
          </View>

          <SectionCard style={styles.safety}>
            <View style={styles.safetyRow}>
              <Feather name="shield" size={20} color={colors.brand.greenText} />
              <View style={styles.flex}>
                <AppText variant="secondaryStrong">Achetez en sécurité</AppText>
                <AppText variant="meta" color={colors.text.body}>
                  Payez dans l’appli ou à la remise du produit. N’envoyez jamais d’argent à l’avance à un inconnu.
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setReportOpen(true)}
              style={styles.linkRow}>
              <Feather name="flag" size={16} color={colors.brand.navy} />
              <AppText variant="secondaryStrong" color={colors.brand.navy}>
                Signaler cette annonce
              </AppText>
            </Pressable>
          </SectionCard>
        </View>

        {similar.data && similar.data.length > 0 ? (
          <View style={styles.similar}>
            <AppText variant="cardTitle" accessibilityRole="header" style={styles.similarTitle}>
              Articles similaires
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarList}>
              {similar.data.map((item) => (
                <View key={item.id} style={{ width: SIMILAR_CARD_WIDTH }}>
                  <ProductCard
                    item={item}
                    cityName={cityNames.get(item.cityId) ?? ''}
                    onPress={() => router.push({ pathname: '/produit/[id]', params: { id: item.id } })}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <BottomActionBar summary={inCart > 0 ? `Déjà ${inCart} dans votre panier` : undefined}>
        {shop.data?.whatsapp ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Écrire à ${shop.data.name} sur WhatsApp`}
            onPress={() => openWhatsApp(shop.data!)}
            style={({ pressed }) => [styles.whatsapp, pressed && styles.whatsappPressed]}>
            <Ionicons name="logo-whatsapp" size={24} color={colors.brand.greenText} />
          </Pressable>
        ) : null}
        <Button
          label={soldOut ? 'Épuisé' : 'Ajouter au panier'}
          icon={soldOut ? undefined : 'shopping-cart'}
          disabled={soldOut}
          loading={stockCheck.isPending}
          onPress={add}
          style={styles.flex}
        />
      </BottomActionBar>

      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} productId={p.id} />
    </View>
  );
}

function StockTag({ product: p }: { product: SaleProduct }) {
  if (p.stock.status === 'out_of_stock') return <Tag label="Épuisé" tone="neutral" />;
  if (p.stock.status === 'low_stock') {
    return <Tag label={p.stock.quantity ? `Plus que ${p.stock.quantity}` : 'Plus que quelques-uns'} />;
  }
  return <Tag label="En stock" tone="green" />;
}

function SellerRow({ shop, loading, cityName }: { shop?: Shop; loading: boolean; cityName?: string }) {
  if (loading) {
    return (
      <View style={styles.seller}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <View style={[styles.flex, { gap: space.sm }]}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={12} width="40%" />
        </View>
      </View>
    );
  }
  if (!shop) return null; // Shop could not load: the rest of the page still works.
  const role = shop.role === 'loueur' ? 'Loueur' : 'Vendeur';
  return (
    <View style={styles.seller} accessible accessibilityLabel={`${role} : ${shop.name}${cityName ? `, ${cityName}` : ''}`}>
      <View style={styles.avatar}>
        <AppText variant="secondaryStrong" color={colors.brand.navyDark}>
          {shop.initials}
        </AppText>
      </View>
      <View style={styles.flex}>
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

function ProduitSkeleton({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.fill}>
      <Skeleton height={PHOTO_HEIGHT} borderRadius={0} />
      <View style={[styles.photoButtons, { top: insets.top + space.sm }]}>
        <IconButton icon="arrow-left" accessibilityLabel="Retour" onPress={onBack} />
      </View>
      <View style={styles.body}>
        <Skeleton height={22} width="85%" />
        <Skeleton height={24} width="40%" />
        <Skeleton height={20} width="30%" />
        <Skeleton height={56} />
        <Skeleton height={90} />
      </View>
    </View>
  );
}

/** Temporary: rentals get their own screen (dates, deposit) in Feature 7. */
function RentalPreview({ product: p, onBack }: { product: RentalProduct; onBack: () => void }) {
  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <ScrollView contentContainerStyle={[styles.body, styles.scroll]}>
        <View style={styles.plainHeader}>
          <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={onBack} />
        </View>
        <View style={styles.titleBlock}>
          <Tag label="Location" />
          <AppText variant="productTitle" accessibilityRole="header">
            {p.name}
          </AppText>
          <AppText variant="display" color={colors.brand.navy}>
            {formatFcfa(p.pricePerDay)}
            <AppText variant="secondary" color={colors.text.muted}>
              {' / jour'}
            </AppText>
          </AppText>
        </View>
        <AppText variant="body" color={colors.text.body}>
          {p.description}
        </AppText>
        <SectionCard>
          <AppText variant="meta" color={colors.text.muted}>
            La fiche location complète (dates, caution, réservation) arrive à l’étape 7.
          </AppText>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.card },
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wrapRow: { flexWrap: 'wrap', gap: space.md },
  plainHeader: { paddingTop: space.md },
  photoButtons: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  body: { padding: space.gutter, gap: space.xl },
  titleBlock: { gap: space.sm },
  section: { gap: space.sm },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 32 },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.default,
  },
  avatar: {
    width: size.touch,
    height: size.touch,
    borderRadius: size.touch / 2,
    backgroundColor: colors.brand.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safety: { backgroundColor: colors.surface.ground },
  safetyRow: { flexDirection: 'row', gap: space.md },
  similar: { gap: space.md, paddingTop: space.sm },
  similarTitle: { paddingHorizontal: space.gutter },
  similarList: { paddingHorizontal: space.gutter, gap: space.md },
  whatsapp: {
    width: size.button,
    height: size.button,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappPressed: { backgroundColor: colors.brand.navySelected },
});
