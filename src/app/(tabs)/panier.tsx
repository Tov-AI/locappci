import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

export default function PanierScreen() {
  return (
    <Screen>
      <AppText variant="screenTitle" accessibilityRole="header" style={{ paddingTop: space.lg }}>
        Panier
      </AppText>
      <EmptyState
        icon="shopping-cart"
        title="Votre panier est vide"
        message="Ajoutez un produit depuis l'accueil ou la recherche."
      />
    </Screen>
  );
}
