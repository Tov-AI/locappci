import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

export default function RechercheScreen() {
  return (
    <Screen>
      <AppText variant="screenTitle" accessibilityRole="header" style={{ paddingTop: space.lg }}>
        Recherche
      </AppText>
      <EmptyState
        icon="search"
        title="Bientôt disponible"
        message="Vous pourrez chercher un produit ou un matériel et filtrer par commune et par prix."
      />
    </Screen>
  );
}
