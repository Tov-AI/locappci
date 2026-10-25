import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { cartTotals, useCartItems } from '@/data/cart';
import { space } from '@/theme';
import { formatFcfa } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';

/** Temporary: the cart was checked and is ready. Feature 9 builds the real Paiement screen. */
export default function PaiementScreen() {
  const goBack = useGoBack();
  const total = cartTotals(useCartItems()).total;
  return (
    <Screen>
      <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={goBack} style={{ marginTop: space.md }} />
      <AppText variant="screenTitle" accessibilityRole="header">
        Paiement
      </AppText>
      <EmptyState
        icon="check-circle"
        title="Panier vérifié"
        message={`Tout est disponible. Total : ${formatFcfa(total)} hors livraison. L’écran Paiement (coordonnées, livraison, Wave, Orange Money) arrive à l’étape 9.`}
      />
    </Screen>
  );
}
