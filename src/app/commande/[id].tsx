import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Order, OrderShop, OrderStep, PaymentMethod } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomActionBar } from '@/components/BottomActionBar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { saveAccount, useAccount } from '@/data/account';
import { answerNotifications, shouldAskNotifications, useNotificationAnswer } from '@/data/notifications';
import { useOnline } from '@/data/online';
import { rememberOrder } from '@/data/orders';
import { useCreateAccount, useOrder } from '@/data/queries';
import { colors, radius, size, space } from '@/theme';
import { formatFcfa } from '@/utils/format';
import { trackingText } from '@/utils/order';

const PAID_WITH: Record<PaymentMethod, string> = {
  wave: 'payée avec Wave',
  orange_money: 'payée avec Orange Money',
  cash: 'paiement à la livraison',
};

const STEPS: { id: OrderStep; label: string }[] = [
  { id: 'confirmed', label: 'Confirmée' },
  { id: 'preparing', label: 'En préparation' },
  { id: 'delivered', label: 'Livrée' },
];

const MIN_PASSWORD = 8;

/**
 * Confirmation (Feature 10): order number, tracking, account offer, notification soft ask.
 * Opened with "replace" after payment, so "Retour" never leads back to a paid checkout.
 */
export default function CommandeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const o = order.data;

  // Keep this phone's copy up to date (status, tracking step) for "Mes commandes".
  useEffect(() => {
    if (order.data && order.isFetchedAfterMount) rememberOrder(order.data);
  }, [order.data, order.isFetchedAfterMount]);
  const keepShopping = () => router.dismissTo('/');

  if (order.isPending) {
    return (
      <SafeAreaView edges={['top']} style={styles.fill}>
        <View style={styles.content}>
          <Skeleton width={56} height={56} borderRadius={28} style={styles.center} />
          <Skeleton height={22} width="60%" style={styles.center} />
          <Skeleton height={120} />
        </View>
      </SafeAreaView>
    );
  }

  if (!o) {
    return (
      <SafeAreaView edges={['top']} style={styles.fill}>
        <EmptyState
          icon="alert-triangle"
          title="Commande introuvable"
          message={order.error?.message ?? ''}
          actionLabel="Réessayer"
          onAction={() => order.refetch()}
        />
        <View style={styles.content}>
          <Button label="Retour à l’accueil" variant="outline" onPress={keepShopping} />
        </View>
      </SafeAreaView>
    );
  }

  const settled = o.status === 'paid' || o.status === 'confirmed';
  // One shop with WhatsApp: the "Vendeur" button writes to it. Several shops: each line has its own link.
  const singleShop = o.shops.length === 1 ? o.shops[0] : undefined;

  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={[styles.check, !settled && styles.checkPending]}>
              <Feather name={settled ? 'check' : 'clock'} size={32} color={colors.text.inverse} />
            </View>
            <AppText variant="display" accessibilityRole="header" style={styles.centerText}>
              {settled ? 'Commande confirmée' : 'Paiement en attente'}
            </AppText>
            <AppText variant="secondary" color={colors.text.muted} style={styles.centerText}>
              {`N° ${o.number} · ${PAID_WITH[o.paymentMethod]} · ${formatFcfa(o.total)}`}
            </AppText>
          </View>

          <SectionCard title="Suivi">
            <Progress step={o.step} />
            {o.shops.map((s) => (
              <View key={s.shopId} style={styles.shopLine}>
                <AppText variant="meta" color={colors.text.body}>
                  {trackingText(s, o)}
                </AppText>
                {o.shops.length > 1 && s.whatsapp ? (
                  <WhatsAppLink shop={s} order={o} />
                ) : null}
              </View>
            ))}
            {o.depositTotal > 0 ? (
              <AppText variant="meta" color={colors.text.body}>
                {`Caution à remettre au retrait : ${formatFcfa(o.depositTotal)}, rendue au retour du matériel.`}
              </AppText>
            ) : null}
          </SectionCard>

          <AccountOffer order={o} />
          <NotificationSoftAsk />
        </ScrollView>

        <BottomActionBar>
          {singleShop?.whatsapp ? (
            <WhatsAppButton
              number={singleShop.whatsapp}
              name={singleShop.shopName}
              message={whatsAppMessage(singleShop, o)}
            />
          ) : null}
          <Button label="Continuer mes achats" onPress={keepShopping} style={styles.flex} />
        </BottomActionBar>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Three bars: green up to the current step. */
function Progress({ step }: { step: OrderStep }) {
  const current = STEPS.findIndex((s) => s.id === step);
  return (
    <View
      style={styles.steps}
      accessible
      accessibilityLabel={`Suivi : étape ${current + 1} sur ${STEPS.length}, ${STEPS[current].label}`}>
      {STEPS.map((s, i) => (
        <View key={s.id} style={styles.step}>
          <View style={[styles.bar, i <= current && styles.barDone]} />
          <AppText variant="caption" color={i <= current ? colors.brand.greenText : colors.text.muted} numberOfLines={1}>
            {s.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function whatsAppMessage(s: OrderShop, o: Order) {
  return `Bonjour ${s.shopName}, je viens de passer la commande ${o.number} sur LOCAPPCI. Merci !`;
}

/** Small text link per shop when the order has several shops (one big button would not fit them all). */
function WhatsAppLink({ shop, order }: { shop: OrderShop; order: Order }) {
  const open = () =>
    Linking.openURL(`https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(whatsAppMessage(shop, order))}`).catch(
      () => showToast("Impossible d'ouvrir WhatsApp sur ce téléphone."),
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Écrire à ${shop.shopName} sur WhatsApp`}
      hitSlop={8}
      onPress={open}
      style={styles.waLink}>
      <Ionicons name="logo-whatsapp" size={18} color={colors.brand.greenText} />
      <AppText variant="secondaryStrong" color={colors.brand.navy}>
        Écrire à la boutique
      </AppText>
    </Pressable>
  );
}

/** "Gardez le suivi de vos commandes": add a password to the details already given. */
function AccountOffer({ order }: { order: Order }) {
  const account = useAccount();
  const online = useOnline();
  const create = useCreateAccount();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [justCreated, setJustCreated] = useState(false);

  if (justCreated) {
    return (
      <View style={styles.done} accessibilityRole="alert">
        <Feather name="check" size={20} color={colors.brand.green} />
        <AppText variant="secondaryStrong" color={colors.brand.greenDark} style={styles.flex}>
          Compte créé. Votre commande y est enregistrée.
        </AppText>
      </View>
    );
  }
  // Already has an account on this phone: nothing to offer.
  if (account) return null;

  const submit = () => {
    if (password.length < MIN_PASSWORD) {
      setError(`${MIN_PASSWORD} caractères minimum.`);
      return;
    }
    setError(undefined);
    create.mutate(
      { orderId: order.id, password },
      {
        onSuccess: (a) => {
          saveAccount(a);
          setPassword('');
          setJustCreated(true);
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <SectionCard title="Gardez le suivi de vos commandes" highlighted>
      <AppText variant="meta" color={colors.text.body}>
        Vos coordonnées sont déjà là. Ajoutez un mot de passe pour :
      </AppText>
      <View style={styles.benefits}>
        {['suivre cette commande et les suivantes', 'payer plus vite la prochaine fois', 'retrouver vos favoris sur tous vos appareils'].map(
          (b) => (
            <View key={b} style={styles.benefit}>
              <Feather name="check" size={16} color={colors.brand.greenText} />
              <AppText variant="meta">{b}</AppText>
            </View>
          ),
        )}
      </View>
      <TextField
        label="Mot de passe"
        placeholder="8 caractères minimum"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(undefined);
        }}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={error}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            onPress={() => setVisible((v) => !v)}
            style={styles.eye}>
            <Feather name={visible ? 'eye-off' : 'eye'} size={20} color={colors.text.muted} />
          </Pressable>
        }
      />
      <Button
        label="Créer mon compte"
        loading={create.isPending}
        disabled={!online}
        onPress={submit}
      />
      {!online ? (
        <AppText variant="meta" color={colors.text.muted}>
          Connexion nécessaire pour créer votre compte.
        </AppText>
      ) : null}
    </SectionCard>
  );
}

/** Our own question first; the phone's permission prompt comes later (Feature 16). */
function NotificationSoftAsk() {
  const answer = useNotificationAnswer();
  const [thanked, setThanked] = useState(false);

  if (thanked) {
    return (
      <View style={styles.done} accessibilityRole="alert">
        <Feather name="bell" size={20} color={colors.brand.green} />
        <AppText variant="secondaryStrong" color={colors.brand.greenDark} style={styles.flex}>
          Merci, c’est noté.
        </AppText>
      </View>
    );
  }
  // undefined = saved answer not read yet: show nothing rather than flash the card.
  if (answer === undefined || !shouldAskNotifications(answer)) return null;

  return (
    <View style={styles.soft}>
      <View style={styles.softRow}>
        <Feather name="bell" size={22} color={colors.brand.orangeText} />
        <AppText variant="secondaryStrong" color={colors.brand.orangeTextDark} style={styles.flex}>
          Être prévenu dès que votre commande est expédiée ?
        </AppText>
      </View>
      <View style={styles.softButtons}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            answerNotifications('yes');
            setThanked(true);
          }}
          style={({ pressed }) => [styles.softYes, pressed && styles.pressed]}>
          <AppText variant="secondaryStrong" color={colors.text.inverse}>
            Oui, me prévenir
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => answerNotifications('later')}
          style={({ pressed }) => [styles.softLater, pressed && styles.pressed]}>
          <AppText variant="secondaryStrong" color={colors.brand.orangeTextDark}>
            Plus tard
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  flex: { flex: 1 },
  content: { padding: space.gutter, paddingTop: 22, gap: space.md, paddingBottom: space.xxl },
  center: { alignSelf: 'center' },
  centerText: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  check: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  checkPending: { backgroundColor: colors.brand.orangeText },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, gap: 6 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.border.input },
  barDone: { backgroundColor: colors.brand.green },
  shopLine: { gap: space.sm },
  waLink: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 36 },
  benefits: { gap: space.xs },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eye: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.brand.greenTint,
  },
  soft: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.brand.orangeTint },
  softRow: { flexDirection: 'row', gap: 10 },
  softButtons: { flexDirection: 'row', gap: space.sm },
  softYes: {
    flex: 1,
    minHeight: size.touch,
    borderRadius: radius.md,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  softLater: {
    minHeight: size.touch,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand.orangeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
