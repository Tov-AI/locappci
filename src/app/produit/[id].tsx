import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { PhotoHeaderSkeleton } from '@/components/PhotoHeader';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { useProduct } from '@/data/queries';
import { RentalDetail } from '@/screens/RentalDetail';
import { SaleDetail } from '@/screens/SaleDetail';
import { colors, space } from '@/theme';
import { useGoBack } from '@/utils/navigation';

/**
 * One route for every product: loads it, then shows the sale screen (Feature 6)
 * or the rental screen (Feature 7) depending on `universe`.
 */
export default function ProduitScreen() {
  const goBack = useGoBack();
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const p = product.data;

  if (product.isPending) {
    return (
      <View style={styles.fill}>
        <PhotoHeaderSkeleton onBack={goBack} />
        <View style={styles.body}>
          <Skeleton height={22} width="85%" />
          <Skeleton height={24} width="40%" />
          <Skeleton height={20} width="30%" />
          <Skeleton height={56} />
          <Skeleton height={90} />
        </View>
      </View>
    );
  }

  if (!p) {
    const gone = product.error instanceof ApiError && product.error.code === 'not_found';
    return (
      <Screen>
        <View style={styles.header}>
          <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={goBack} />
        </View>
        <EmptyState
          icon={gone ? 'slash' : 'alert-triangle'}
          title={gone ? "Cette annonce n'est plus disponible" : "Impossible de charger l'annonce"}
          message={gone ? 'Le vendeur l’a retirée ou elle a été vendue.' : (product.error?.message ?? '')}
          actionLabel={gone ? 'Retour' : 'Réessayer'}
          onAction={gone ? goBack : () => product.refetch()}
        />
      </Screen>
    );
  }

  return p.universe === 'location' ? (
    <RentalDetail product={p} savedAt={product.dataUpdatedAt} />
  ) : (
    <SaleDetail product={p} savedAt={product.dataUpdatedAt} />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.card },
  body: { padding: space.gutter, gap: space.xl },
  header: { paddingTop: space.md },
});
