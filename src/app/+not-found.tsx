import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

/** Opened from an old or wrong link (e.g. locappci://quelque-chose). */
export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen>
      <EmptyState
        icon="compass"
        title="Page introuvable"
        message="Ce lien n’existe pas ou plus dans l’appli."
        actionLabel="Retour à l’accueil"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
