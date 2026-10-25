import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api, type SaleProduct } from '@/api';
import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { BottomActionBar } from '@/components/BottomActionBar';
import { Button } from '@/components/Button';
import { Description } from '@/components/Description';
import { InfoBlock } from '@/components/InfoBlock';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PhotoHeader } from '@/components/PhotoHeader';
import { ProductCard } from '@/components/ProductCard';
import { ReportSheet } from '@/components/ReportSheet';
import { SellerRow } from '@/components/SellerRow';
import { showToast } from '@/components/Toast';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { addToCart, useCartQuantity } from '@/data/cart';
import { useOnline } from '@/data/online';
import { keys, useCategories, useCities, useShop, useSimilarProducts, useStockCheck } from '@/data/queries';
import { colors, space } from '@/theme';
import { formatFcfa, formatTime } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';

const SIMILAR_CARD_WIDTH = 168;

/** Produit (Feature 6): one product for sale. */
export function SaleDetail({ product: p, savedAt }: { product: SaleProduct; savedAt: number }) {
  const router = useRouter();
  const goBack = useGoBack();
  const queryClient = useQueryClient();
  const online = useOnline();
  const shop = useShop(p.shopId);
  const cities = useCities();
  const categories = useCategories();
  const similar = useSimilarProducts(p.id, p.universe, p.categoryId);
  const stockCheck = useStockCheck();
  const inCart = useCartQuantity(p.id);
  const [reportOpen, setReportOpen] = useState(false);

  const cityNames = useMemo(() => new Map((cities.data ?? []).map((c) => [c.id, c.name])), [cities.data]);
  const categoryName = categories.data?.find((c) => c.id === p.categoryId)?.name;
  const cityName = cityNames.get(p.cityId);
  const price = formatFcfa(p.price);
  const soldOut = p.stock.status === 'out_of_stock';

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
                  stock: { status: check.status, quantity: check.available ? old.stock.quantity : 0 },
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
        <PhotoHeader
          productId={p.id}
          images={p.images}
          name={p.name}
          shareMessage={`${p.name} – ${price}\n${p.webUrl}`}
          onBack={goBack}
        />

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

          <SellerRow
            shop={shop.data}
            loading={shop.isPending}
            cityName={shop.data ? cityNames.get(shop.data.cityId) : undefined}
          />

          <Description text={p.description} />

          <InfoBlock
            icon="shield"
            iconColor={colors.brand.greenText}
            title="Achetez en sécurité"
            text="Payez dans l’appli ou à la remise du produit. N’envoyez jamais d’argent à l’avance à un inconnu."
            links={[{ icon: 'flag', label: 'Signaler cette annonce', onPress: () => setReportOpen(true) }]}
          />
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
          <WhatsAppButton
            number={shop.data.whatsapp}
            name={shop.data.name}
            message={
              `Bonjour ${shop.data.name}, je suis intéressé(e) par « ${p.name} » à ${price} sur LOCAPPCI. ` +
              `Est-il toujours disponible ?\n${p.webUrl}`
            }
          />
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

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.card },
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wrapRow: { flexWrap: 'wrap', gap: space.md },
  body: { padding: space.gutter, gap: space.xl },
  titleBlock: { gap: space.sm },
  similar: { gap: space.md, paddingTop: space.sm },
  similarTitle: { paddingHorizontal: space.gutter },
  similarList: { paddingHorizontal: space.gutter, gap: space.md },
});
