import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Order, OrderStatus } from '@/api';
import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { isInProgress, useMyOrders } from '@/data/orders';
import { colors, radius, space } from '@/theme';
import { formatDayShort, toIsoDate } from '@/utils/dates';
import { formatFcfa } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';

const STATUS: Record<OrderStatus, string> = {
  pending_payment: 'Paiement en attente',
  awaiting_confirmation: 'Paiement en vérification',
  paid: 'Payée',
  confirmed: 'À payer à la livraison',
  payment_failed: 'Paiement refusé',
  cancelled: 'Annulée',
};

/** Mes commandes: orders placed from this phone, newest first. */
export default function CommandesScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const orders = useMyOrders();

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={goBack} />
        <AppText variant="headerTitle" accessibilityRole="header">
          Mes commandes
        </AppText>
      </View>
      {orders.length === 0 ? (
        <EmptyState
          icon="package"
          title="Aucune commande pour l’instant"
          message="Vos commandes passées depuis ce téléphone apparaîtront ici."
          actionLabel="Découvrir les annonces"
          onAction={() => router.dismissTo('/')}
        />
      ) : (
        orders.map((o) => (
          <OrderRow key={o.id} order={o} onPress={() => router.push({ pathname: '/commande/[id]', params: { id: o.id } })} />
        ))
      )}
    </Screen>
  );
}

function OrderRow({ order: o, onPress }: { order: Order; onPress: () => void }) {
  const shops = o.shops.map((s) => s.shopName).join(', ');
  const date = formatDayShort(toIsoDate(new Date(o.createdAt)));
  const active = isInProgress(o);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Commande ${o.number}, ${date}, ${formatFcfa(o.total)}, ${active ? 'en cours' : STATUS[o.status]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.texts}>
        <View style={styles.top}>
          <AppText variant="bodyStrong">{o.number}</AppText>
          {active ? <Tag label="En cours" /> : <Tag label={STATUS[o.status]} tone="neutral" />}
        </View>
        <AppText variant="meta" color={colors.text.muted} numberOfLines={1}>
          {`${date} · ${shops}`}
        </AppText>
        <AppText variant="secondaryStrong">{formatFcfa(o.total)}</AppText>
      </View>
      <Feather name="chevron-right" size={18} color={colors.text.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.card,
  },
  pressed: { opacity: 0.85 },
  texts: { flex: 1, gap: space.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
