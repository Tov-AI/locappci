import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

export default function FavorisScreen() {
  return (
    <Screen>
      <AppText variant="screenTitle" accessibilityRole="header" style={{ paddingTop: space.lg }}>
        Favoris
      </AppText>
      <EmptyState
        icon="heart"
        title="Aucun favori pour l'instant"
        message="Touchez le cœur sur une annonce pour la retrouver ici, même hors connexion."
      />
    </Screen>
  );
}
