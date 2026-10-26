import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError, type Order, type PaymentMethod } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomActionBar } from '@/components/BottomActionBar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { InitialTile, OptionCard } from '@/components/OptionCard';
import { TransferSheet } from '@/components/TransferSheet';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { applyCartCheck, cartTotals, clearCart, getCartItems, toCheckLines, useCartItems } from '@/data/cart';
import { useCity } from '@/data/city';
import { saveCustomer, useSavedCustomer } from '@/data/customer';
import { useOnline } from '@/data/online';
import { rememberOrder } from '@/data/orders';
import { keys, useCartCheck, useCities, useCreateOrder, useDeliveryOptions, waitingForNetwork } from '@/data/queries';
import { colors, radius, space } from '@/theme';
import { formatFcfa } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';
import { formatCiPhone, normalizeCiPhone } from '@/utils/phone';

const METHODS: { id: PaymentMethod; initial: string; label: string; hint: string }[] = [
  // No cash on delivery (client's answer). Transfer to the LOCAPPCI number until merchant accounts exist.
  { id: 'wave', initial: 'W', label: 'Wave', hint: 'Transfert vers LOCAPPCI, puis la référence' },
  { id: 'orange_money', initial: 'OM', label: 'Orange Money', hint: 'Transfert vers LOCAPPCI, puis la référence' },
];

const PAY_LABEL: Record<PaymentMethod, string> = {
  wave: 'Payer avec Wave',
  orange_money: 'Payer avec Orange Money',
  cash: 'Confirmer la commande',
};

type Errors = { name?: string; phone?: string; address?: string };
type Notice = { text: string; backToCart?: boolean };

/** More than just a commune name ("Yopougon,"): the rider needs a district or a landmark. */
function hasStreetDetails(address: string, communes: string[]) {
  let rest = address.trim();
  for (const c of communes) {
    if (rest.toLowerCase().startsWith(c.toLowerCase())) rest = rest.slice(c.length);
  }
  return rest.replace(/[\s,.-]/g, '').length >= 3;
}

/** A new key for each different checkout; retries of the same one reuse it. */
const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Paiement (Feature 9): contact details (no account), delivery per shop, payment method.
 * "Payer" re-checks the cart, creates the order (idempotent), then shows how to pay:
 * v1 = transfer to the LOCAPPCI Wave / Orange Money number + transaction reference;
 * with merchant accounts later (Feature 15) = the provider's payment page.
 */
export default function PaiementScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const queryClient = useQueryClient();
  const online = useOnline();
  const items = useCartItems();
  const savedCustomer = useSavedCustomer();
  const city = useCity();
  const cities = useCities();
  const cartCheck = useCartCheck();
  const createOrder = useCreateOrder();
  const scrollRef = useRef<ScrollViewInstance>(null);

  const cityNames = useMemo(() => (cities.data ?? []).map((c) => c.name), [cities.data]);
  const shopIds = useMemo(() => [...new Set(items.map((i) => i.shopId))], [items]);
  const shopNames = useMemo(() => new Map(items.map((i) => [i.shopId, i.shopName])), [items]);
  const [address, setAddress] = useState(savedCustomer?.address ?? '');
  // Delivery is priced by distance: deliver to the commune named in the address, else the chosen one.
  const deliveryCityId = useMemo(() => {
    const text = address.trim().toLowerCase();
    const named = (cities.data ?? []).find((c) => text.startsWith(c.name.toLowerCase()));
    return named?.id ?? (city || undefined);
  }, [address, cities.data, city]);
  const delivery = useDeliveryOptions(shopIds, deliveryCityId);

  const [name, setName] = useState(savedCustomer?.name ?? '');
  const [phone, setPhone] = useState(savedCustomer ? formatCiPhone(savedCustomer.phone) : '');
  const [method, setMethod] = useState<PaymentMethod>('wave');
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<Order | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [working, setWorking] = useState(false);

  // Saved details may load a moment after the screen opens: fill empty fields once.
  useEffect(() => {
    if (!savedCustomer) return;
    setName((v) => v || savedCustomer.name);
    setPhone((v) => v || formatCiPhone(savedCustomer.phone));
    setAddress((v) => v || savedCustomer.address);
  }, [savedCustomer]);

  // Start the address with the chosen commune, as the design suggests ("Cocody, …").
  useEffect(() => {
    if (address || savedCustomer || !city) return;
    const cityName = cities.data?.find((c) => c.id === city)?.name;
    if (cityName) setAddress(`${cityName}, `);
  }, [address, savedCustomer, city, cities.data]);

  // Default delivery for each shop: its first option (home delivery when offered).
  useEffect(() => {
    if (!delivery.data) return;
    setChoices((prev) => {
      const next = { ...prev };
      for (const s of delivery.data) {
        if (!s.options.some((o) => o.id === next[s.shopId]) && s.options[0]) next[s.shopId] = s.options[0].id;
      }
      return next;
    });
  }, [delivery.data]);

  const chosen = (delivery.data ?? []).map((s) => s.options.find((o) => o.id === choices[s.shopId]));
  const homeDelivery = chosen.some((o) => o?.kind === 'home');
  const deliveryTotal = chosen.reduce((sum, o) => sum + (o?.price ?? 0), 0);
  const totals = cartTotals(items);
  const total = totals.total + deliveryTotal;
  const count = totals.saleUnits + totals.rentalCount;
  const deliveryReady = !!delivery.data && chosen.every(Boolean);

  // Same checkout content → same idempotency key, so a retry never creates a second order.
  const signature = JSON.stringify([toCheckLines(items), choices, name.trim(), phone, address.trim()]);
  const idempotencyKey = useMemo(() => newKey(), [signature]);

  const showNotice = (n: Notice) => {
    setNotice(n);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const finish = (order: Order) => {
    queryClient.setQueryData(keys.order(order.id), order);
    rememberOrder(order);
    clearCart();
    setPending(null);
    // Replace: "Retour" from the confirmation must not come back to a paid checkout.
    router.replace({ pathname: '/commande/[id]', params: { id: order.id } });
  };

  const afterPaymentAttempt = async (order: Order) => {
    try {
      const fresh = await api.getOrder(order.id);
      if (fresh.status === 'paid' || fresh.status === 'confirmed') finish(fresh);
      else
        showNotice({
          text: 'Le paiement n’a pas abouti. Aucun montant n’a été débité. Réessayez ou choisissez un autre moyen de paiement.',
        });
    } catch (e) {
      showNotice({ text: e instanceof Error ? e.message : 'Vérification impossible. Réessayez.' });
    }
  };

  /** "J'ai payé" in the transfer sheet. Returns an error message to show in the sheet, if any. */
  const submitReference = async (reference: string) => {
    if (!pending) return undefined;
    try {
      const order = await api.submitPaymentReference(pending.id, reference);
      setTransferOpen(false);
      finish(order);
      return undefined;
    } catch (e) {
      return e instanceof Error ? e.message : 'Envoi impossible. Réessayez.';
    }
  };

  const pay = async () => {
    setNotice(null);
    const normalizedPhone = normalizeCiPhone(phone);
    const nextErrors: Errors = {
      name: name.trim().length < 2 ? 'Indiquez votre nom.' : undefined,
      phone: normalizedPhone ? undefined : 'Numéro ivoirien à 10 chiffres, ex. 07 00 00 00 00.',
      address: homeDelivery && !hasStreetDetails(address, cityNames) ? 'Ajoutez le quartier ou un repère.' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.phone || nextErrors.address || !normalizedPhone) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const customer = { name: name.trim(), phone: normalizedPhone, address: address.trim() };
    saveCustomer(customer);
    setWorking(true);

    try {
      // 1. Is everything still available at the same price?
      const check = await cartCheck.mutateAsync(toCheckLines(getCartItems()));
      if (check.lines.some((l) => !l.ok || l.priceChanged)) {
        applyCartCheck(check.lines);
        showNotice({ text: 'Votre panier a changé (stock, dates ou prix). Vérifiez-le avant de payer.', backToCart: true });
        return;
      }

      // 2. Create the order (or get the same one back if this is a retry).
      const order = await createOrder.mutateAsync({
        idempotencyKey,
        customer,
        lines: toCheckLines(getCartItems()),
        deliveries: Object.entries(choices).map(([shopId, optionId]) => ({ shopId, optionId })),
        deliveryCityId,
        paymentMethod: method,
      });

      // 3. Cash: nothing to pay now. Wave / Orange Money: hand over to the provider.
      if (order.status === 'confirmed' || order.status === 'paid') {
        finish(order);
      } else if (order.paymentUrl) {
        setPending(order);
        await Linking.openURL(order.paymentUrl);
        showNotice({ text: 'Une fois le paiement validé, revenez ici et appuyez sur « J’ai payé ».' });
      } else if (order.status === 'awaiting_confirmation') {
        // Reference already sent for this order (retry after closing the app, say).
        finish(order);
      } else if (order.transferTo) {
        setPending(order);
        setTransferOpen(true);
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'cart_changed') {
        showNotice({ text: e.message, backToCart: true });
      } else {
        showNotice({ text: e instanceof Error ? e.message : 'Un problème est survenu. Réessayez.' });
      }
    } finally {
      setWorking(false);
    }
  };

  if (items.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={styles.fill}>
        <Header onBack={goBack} />
        <EmptyState
          icon="shopping-cart"
          title="Votre panier est vide"
          message="Ajoutez un produit ou une location avant de payer."
          actionLabel="Retour"
          onAction={goBack}
        />
      </SafeAreaView>
    );
  }

  const waitingForProvider = !!pending?.paymentUrl;

  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <Header onBack={goBack} />
      {!online ? <OfflineBanner message="Hors connexion. Vos informations restent saisies ; le paiement demande du réseau." /> : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {notice ? (
            <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Feather name="alert-circle" size={18} color={colors.status.danger} />
              <View style={styles.flex}>
                <AppText variant="secondary">{notice.text}</AppText>
                {notice.backToCart ? (
                  <Button label="Revoir le panier" variant="outline" onPress={goBack} style={styles.noticeButton} />
                ) : null}
              </View>
            </View>
          ) : null}

          <SectionCard title="Vos coordonnées">
            <AppText variant="meta" color={colors.text.muted}>
              Pas besoin de compte. Vous pourrez le créer après le paiement.
            </AppText>
            <TextField
              label="Nom et prénom"
              placeholder="Aya Koné"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setErrors((e) => ({ ...e, name: undefined }));
              }}
              autoComplete="name"
              textContentType="name"
              error={errors.name}
            />
            <TextField
              label="Téléphone"
              placeholder="07 00 00 00 00"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setErrors((e) => ({ ...e, phone: undefined }));
              }}
              onBlur={() => {
                const n = normalizeCiPhone(phone);
                if (n) setPhone(formatCiPhone(n));
              }}
              error={errors.phone}
            />
            {homeDelivery ? (
              <TextField
                label="Commune et adresse"
                placeholder="Cocody, Riviera 2, près de…"
                value={address}
                onChangeText={(v) => {
                  setAddress(v);
                  setErrors((e) => ({ ...e, address: undefined }));
                }}
                autoComplete="street-address"
                error={errors.address}
              />
            ) : null}
          </SectionCard>

          <SectionCard title="Livraison">
            {waitingForNetwork(delivery) ? (
              <AppText variant="meta" color={colors.text.muted}>
                Connexion nécessaire pour afficher les options de livraison.
              </AppText>
            ) : delivery.isPending ? (
              <AppText variant="meta" color={colors.text.muted}>
                Chargement des options…
              </AppText>
            ) : delivery.isError ? (
              <View style={styles.gap}>
                <AppText variant="meta" color={colors.status.danger}>
                  {delivery.error.message}
                </AppText>
                <Button label="Réessayer" variant="outline" onPress={() => delivery.refetch()} />
              </View>
            ) : (
              (delivery.data ?? []).map((s) => (
                <View key={s.shopId} style={styles.gap}>
                  {shopIds.length > 1 ? (
                    <AppText variant="secondaryStrong" color={colors.text.body}>
                      {shopNames.get(s.shopId) || 'Boutique'}
                    </AppText>
                  ) : null}
                  <View style={styles.options} accessibilityRole="radiogroup">
                    {s.options.map((o) => (
                      <OptionCard
                        key={o.id}
                        label={o.label}
                        // Price and detail on two lines: two cards side by side are narrow on a 360 phone.
                        hint={`${o.price > 0 ? formatFcfa(o.price) : 'Gratuit'}\n${o.detail}`}
                        hideRadio
                        selected={choices[s.shopId] === o.id}
                        onSelect={() => setChoices((c) => ({ ...c, [s.shopId]: o.id }))}
                        style={styles.option}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </SectionCard>

          <SectionCard title="Moyen de paiement">
            <View style={styles.gap} accessibilityRole="radiogroup">
              {METHODS.map((m) => (
                <OptionCard
                  key={m.id}
                  label={m.label}
                  hint={m.hint}
                  leading={<InitialTile text={m.initial} />}
                  selected={method === m.id}
                  onSelect={() => setMethod(m.id)}
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Récapitulatif">
            <Row label={`Articles et locations (${count})`} value={formatFcfa(totals.total)} />
            <Row label="Livraison" value={deliveryTotal ? formatFcfa(deliveryTotal) : 'Gratuite'} />
            <View style={styles.divider} />
            <Row label="Total" value={formatFcfa(total)} strong />
            {totals.depositTotal > 0 ? (
              <AppText variant="meta" color={colors.text.body}>
                {`Caution${totals.rentalCount > 1 ? 's' : ''} à remettre au retrait : ${formatFcfa(totals.depositTotal)}, rendue${totals.rentalCount > 1 ? 's' : ''} au retour du matériel.`}
              </AppText>
            ) : null}
          </SectionCard>
        </ScrollView>

        <BottomActionBar
          summary={
            online
              ? `${count} article${count > 1 ? 's' : ''} · livraison ${deliveryTotal ? 'incluse' : 'gratuite'}`
              : 'Connexion nécessaire pour payer'
          }
          total={formatFcfa(total)}>
          {waitingForProvider ? (
            <Button
              label="J’ai payé · Vérifier"
              loading={working}
              onPress={async () => {
                setWorking(true);
                await afterPaymentAttempt(pending!);
                setWorking(false);
              }}
              style={styles.flex}
            />
          ) : (
            <Button
              label={PAY_LABEL[method]}
              icon="lock"
              loading={working}
              disabled={!online || !deliveryReady}
              onPress={pay}
              style={styles.flex}
            />
          )}
        </BottomActionBar>
      </KeyboardAvoidingView>

      {pending?.transferTo ? (
        <TransferSheet
          visible={transferOpen}
          onClose={() => {
            setTransferOpen(false);
            showNotice({ text: 'Paiement non terminé. Votre commande vous attend : appuyez à nouveau sur le bouton pour payer.' });
          }}
          order={pending}
          onSubmit={submitReference}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton icon="arrow-left" accessibilityLabel="Retour" onPress={onBack} />
      <AppText variant="headerTitle" accessibilityRole="header">
        Paiement
      </AppText>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant={strong ? 'bodyStrong' : 'secondary'} color={colors.text.body}>
        {label}
      </AppText>
      <AppText variant={strong ? 'cardTitle' : 'secondaryStrong'}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    paddingBottom: space.md,
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  content: { padding: space.gutter, gap: 14, paddingBottom: space.xxl },
  gap: { gap: space.sm },
  options: { flexDirection: 'row', gap: space.sm },
  option: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  divider: { height: 1, backgroundColor: colors.border.default },
  notice: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.status.danger,
    backgroundColor: colors.surface.card,
  },
  noticeButton: { marginTop: space.sm },
});
