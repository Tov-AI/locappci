import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { useCartItems } from '@/data/cart';
import { colors, space } from '@/theme';
import { formatFcfa } from '@/utils/format';

/** Temporary: lists what Produit added. The full Panier screen arrives with Feature 8. */
export default function PanierScreen() {
  const items = useCartItems();

  return (
    <Screen>
      <AppText variant="screenTitle" accessibilityRole="header" style={{ paddingTop: space.lg }}>
        Panier
      </AppText>
      {items.length === 0 ? (
        <EmptyState
          icon="shopping-cart"
          title="Votre panier est vide"
          message="Ajoutez un produit depuis l'accueil ou la recherche."
        />
      ) : (
        <>
          {items.map((i) => (
            <SectionCard key={i.productId}>
              <AppText variant="secondaryStrong">{i.name}</AppText>
              <AppText variant="meta" color={colors.text.muted}>
                {[`${i.quantity} × ${formatFcfa(i.price)}`, i.shopName].filter(Boolean).join(' · ')}
              </AppText>
            </SectionCard>
          ))}
          <AppText variant="meta" color={colors.text.muted}>
            L’écran Panier complet (quantités, livraison, total) arrive à l’étape 8.
          </AppText>
        </>
      )}
    </Screen>
  );
}
