import { EmptyState } from '@/components/EmptyState';

type Props = {
  /** What will appear once the network is back: "les annonces", "cette annonce"… */
  what: string;
  onRetry: () => void;
};

/**
 * Shown when there is no network AND nothing saved on the phone yet.
 * (With saved data, screens show it with the offline banner instead.)
 * The page fills itself in as soon as the network is back; "Réessayer" is for impatient thumbs.
 */
export function NoConnection({ what, onRetry }: Props) {
  return (
    <EmptyState
      icon="wifi-off"
      title="Pas de connexion"
      message={`${what.charAt(0).toUpperCase()}${what.slice(1)} s’afficheront dès le retour du réseau.`}
      actionLabel="Réessayer"
      onAction={onRetry}
    />
  );
}
