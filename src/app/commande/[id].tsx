import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { OrderStatus } from '@/api';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Skeleton } from '@/components/Skeleton';
import { useOrder } from '@/data/queries';
import { colors, space } from '@/theme';
import { formatFcfa } from '@/utils/format';

const STATUS: Record<OrderStatus, string> = {
  pending_payment: 'En attente de paiement',
  paid: 'Payée',
  confirmed: 'Confirmée · paiement à la livraison',
  payment_failed: 'Paiement refusé',
  cancelled: 'Annulée',
};

/** Temporary order screen: proves the payment flow. Feature 10 builds the full Confirmation. */
export default function CommandeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const o = order.data;

  return (
    <Screen>
      <View style={styles.top} />
      {order.isPending ? (
        <Skeleton height={160} />
      ) : !o ? (
        <EmptyState
          icon="alert-triangle"
          title="Commande introuvable"
          message={order.error?.message ?? ''}
          actionLabel="Réessayer"
          onAction={() => order.refetch()}
        />
      ) : (
        <>
          <EmptyState icon="check-circle" title={`Commande ${o.number}`} message={STATUS[o.status]} />
          <SectionCard>
            <Row label="Articles et locations" value={formatFcfa(o.itemsTotal)} />
            <Row label="Livraison" value={o.deliveryTotal ? formatFcfa(o.deliveryTotal) : 'Gratuite'} />
            <Row label="Total" value={formatFcfa(o.total)} />
            {o.depositTotal > 0 ? (
              <AppText variant="meta" color={colors.text.muted}>
                {`Caution à remettre au retrait : ${formatFcfa(o.depositTotal)}`}
              </AppText>
            ) : null}
          </SectionCard>
          <AppText variant="meta" color={colors.text.muted}>
            L’écran de confirmation complet (suivi, création de compte, notifications) arrive à l’étape 10.
          </AppText>
        </>
      )}
      <Button label="Retour à l’accueil" variant="outline" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="secondary" color={colors.text.body}>
        {label}
      </AppText>
      <AppText variant="secondaryStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { height: space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
