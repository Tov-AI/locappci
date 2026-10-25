import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

export default function CompteScreen() {
  return (
    <Screen>
      <AppText variant="screenTitle" accessibilityRole="header" style={{ paddingTop: space.lg }}>
        Mon compte
      </AppText>
      <EmptyState
        icon="user"
        title="Connectez-vous bientôt"
        message="Vos commandes, favoris et paramètres seront regroupés ici."
      />
    </Screen>
  );
}
