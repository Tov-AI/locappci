import { useRouter } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

export default function CompteScreen() {
  const router = useRouter();
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
      {/* Development only: never shown in a store build. */}
      {__DEV__ ? (
        <>
          <Button label="Voir les composants (dev)" variant="outline" icon="grid" onPress={() => router.push('/composants')} />
          <Button label="Voir les données (dev)" variant="outline" icon="database" onPress={() => router.push('/donnees')} />
        </>
      ) : null}
    </Screen>
  );
}
