import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Skeleton } from '@/components/Skeleton';
import { useProduct } from '@/data/queries';
import { colors, space } from '@/theme';
import { formatFcfa } from '@/utils/format';

/**
 * Temporary product screen: proves navigation and data loading from Accueil.
 * The full Produit (feature 6) and Location détail (feature 7) screens replace it.
 */
export default function ProduitScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const p = product.data;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={() => router.back()} />
      </View>

      {product.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={22} width="80%" />
          <Skeleton height={20} width="40%" />
          <Skeleton height={60} />
        </View>
      ) : product.isError || !p ? (
        <EmptyState
          icon="alert-triangle"
          title="Cette annonce n'est plus disponible"
          message={product.error?.message ?? ''}
          actionLabel="Retour à l'accueil"
          onAction={() => router.back()}
        />
      ) : (
        <>
          <View style={styles.titleBlock}>
            {p.universe === 'location' ? <Tag label="Location" /> : null}
            <AppText variant="productTitle" accessibilityRole="header">
              {p.name}
            </AppText>
            <AppText variant="display" color={colors.brand.navy}>
              {formatFcfa(p.universe === 'vente' ? p.price : p.pricePerDay)}
              {p.universe === 'location' ? (
                <AppText variant="secondary" color={colors.text.muted}>
                  {' / jour'}
                </AppText>
              ) : null}
            </AppText>
          </View>
          <AppText variant="body" color={colors.text.body}>
            {p.description}
          </AppText>
          <SectionCard>
            <AppText variant="meta" color={colors.text.muted}>
              {p.universe === 'vente'
                ? 'La fiche produit complète (photos, boutique, panier) arrive à l’étape 6.'
                : 'La fiche location complète (dates, caution, réservation) arrive à l’étape 7.'}
            </AppText>
          </SectionCard>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.md },
  loading: { gap: space.md },
  titleBlock: { gap: space.sm },
});
