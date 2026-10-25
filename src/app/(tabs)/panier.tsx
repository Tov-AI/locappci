import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CartCheckResult } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomActionBar } from '@/components/BottomActionBar';
import { Button } from '@/components/Button';
import { CartLine, type LineMessage } from '@/components/CartLine';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SectionCard } from '@/components/SectionCard';
import {
  applyCartCheck,
  cartTotals,
  getCartItems,
  lineSignature,
  removeLine,
  restoreLine,
  setQuantity,
  toCheckLines,
  useCartItems,
  type CartItem,
} from '@/data/cart';
import { useOnline } from '@/data/online';
import { useCartCheck } from '@/data/queries';
import { colors, fontFamily, radius, space } from '@/theme';
import { formatDayShort, today } from '@/utils/dates';
import { formatFcfa } from '@/utils/format';

/** How long "… retiré · Annuler" stays. */
const UNDO_MS = 6000;

/** A message is shown only while the line is unchanged (same quantity / dates). */
type Issue = LineMessage & { signature: string };

/**
 * Panier (Feature 8): lines grouped by shop, quantities, rental dates, totals.
 * "Commander" checks the whole cart live in one request before going to payment.
 */
export default function PanierScreen() {
  const router = useRouter();
  const online = useOnline();
  const items = useCartItems();
  const cartCheck = useCartCheck();
  const [issues, setIssues] = useState<Record<string, Issue>>({});
  const [removed, setRemoved] = useState<{ line: CartItem; index: number } | null>(null);
  // Result of "Commander", shown at the top of the list (the tab bar and the action bar
  // leave no room for a toast here).
  const [notice, setNotice] = useState<{ text: string; blocking: boolean } | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const showNotice = (text: string, blocking: boolean) => {
    setNotice({ text, blocking });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // The "Annuler" row disappears by itself.
  useEffect(() => {
    if (!removed) return;
    const id = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(id);
  }, [removed]);

  const groups = useMemo(() => groupByShop(items), [items]);
  const totals = cartTotals(items);
  const count = totals.saleUnits + totals.rentalCount;

  // Messages for each line: from the last check, or worked out on the phone (past rental dates).
  const messages = useMemo(() => {
    const out: Record<string, LineMessage> = {};
    for (const i of items) {
      if (i.rental && i.rental.startDate < today()) {
        out[i.productId] = { text: 'Ces dates sont passées. Choisissez de nouvelles dates.', blocking: true };
        continue;
      }
      const issue = issues[i.productId];
      if (issue && issue.signature === lineSignature(i)) out[i.productId] = issue;
    }
    return out;
  }, [items, issues]);
  const blocked = Object.values(messages).some((m) => m.blocking);

  const open = (i: CartItem) => router.push({ pathname: '/produit/[id]', params: { id: i.productId } });

  const remove = (i: CartItem) => {
    const r = removeLine(i.productId);
    if (r) setRemoved(r);
  };

  const order = () => {
    setNotice(null);
    const before = new Map(getCartItems().map((i) => [i.productId, i]));
    cartCheck.mutate(toCheckLines(getCartItems()), {
      onSuccess: ({ lines }) => {
        applyCartCheck(lines);
        const after = new Map(getCartItems().map((i) => [i.productId, i]));
        const next: Record<string, Issue> = {};
        for (const r of lines) {
          const old = before.get(r.productId);
          const now = after.get(r.productId);
          if (!old || !now) continue;
          const message = describe(r, old, now);
          if (message) next[r.productId] = { ...message, signature: lineSignature(now) };
        }
        setIssues(next);

        const values = Object.values(next);
        if (values.some((m) => m.blocking)) {
          showNotice('Certains articles ne sont plus disponibles. Corrigez-les pour continuer.', true);
        } else if (values.length > 0) {
          showNotice('Votre panier a été mis à jour. Vérifiez le total puis commandez.', false);
        } else {
          router.push('/paiement');
        }
      },
      onError: (error) => showNotice(error.message, true),
    });
  };

  if (items.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={styles.fill}>
        <View style={styles.header}>
          <AppText variant="screenTitle" accessibilityRole="header">
            Panier
          </AppText>
        </View>
        {removed ? <UndoRow removed={removed} onUndo={() => (restoreLine(removed), setRemoved(null))} /> : null}
        <EmptyState
          icon="shopping-cart"
          title="Votre panier est vide"
          message="Ajoutez un produit ou réservez une location depuis l’accueil ou la recherche."
          actionLabel="Découvrir les annonces"
          onAction={() => router.navigate('/')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <View style={styles.header}>
        <AppText variant="screenTitle" accessibilityRole="header">
          Panier
        </AppText>
        <AppText variant="meta" color={colors.text.muted}>
          {`${count} article${count > 1 ? 's' : ''}`}
        </AppText>
      </View>
      {!online ? <OfflineBanner message="Hors connexion. Votre panier reste enregistré ; la commande demande du réseau." /> : null}

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {notice ? (
          <View
            style={[styles.notice, notice.blocking ? styles.noticeDanger : styles.noticeInfo]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            <Feather
              name={notice.blocking ? 'alert-circle' : 'info'}
              size={18}
              color={notice.blocking ? colors.status.danger : colors.brand.navy}
            />
            <AppText variant="secondary" color={colors.text.primary} style={styles.flex}>
              {notice.text}
            </AppText>
          </View>
        ) : null}
        {removed ? <UndoRow removed={removed} onUndo={() => (restoreLine(removed), setRemoved(null))} /> : null}

        {groups.map((g) => (
          <SectionCard key={g.shopId} title={g.shopName || 'Boutique'}>
            {g.lines.map((i, n) => (
              <View key={i.productId} style={n > 0 ? styles.separated : undefined}>
                <CartLine
                  item={i}
                  message={messages[i.productId]}
                  onOpen={() => open(i)}
                  onQuantity={(q) => setQuantity(i.productId, q)}
                  onRemove={() => remove(i)}
                />
              </View>
            ))}
          </SectionCard>
        ))}

        <SectionCard title="Récapitulatif">
          {totals.saleUnits > 0 ? (
            <Row label={`Articles (${totals.saleUnits})`} value={formatFcfa(totals.saleTotal)} />
          ) : null}
          {totals.rentalCount > 0 ? (
            <Row label={`Locations (${totals.rentalCount})`} value={formatFcfa(totals.rentalTotal)} />
          ) : null}
          <Row label="Livraison" value="À l’étape suivante" muted />
          <View style={styles.divider} />
          <Row label="Total" value={formatFcfa(totals.total)} strong />
          {totals.depositTotal > 0 ? (
            <View style={styles.deposit}>
              <Feather name="lock" size={16} color={colors.brand.navy} />
              <AppText variant="meta" color={colors.text.body} style={styles.flex}>
                {`Caution${totals.rentalCount > 1 ? 's' : ''} à prévoir en plus : ${formatFcfa(totals.depositTotal)}, rendue${totals.rentalCount > 1 ? 's' : ''} au retour du matériel.`}
              </AppText>
            </View>
          ) : null}
        </SectionCard>
      </ScrollView>

      <BottomActionBar
        aboveTabBar
        summary={
          online
            ? `${count} article${count > 1 ? 's' : ''} · hors livraison`
            : 'Connexion nécessaire pour commander'
        }
        total={formatFcfa(totals.total)}>
        <Button
          label="Commander"
          loading={cartCheck.isPending}
          disabled={blocked || !online}
          onPress={order}
          style={styles.flex}
        />
      </BottomActionBar>
    </SafeAreaView>
  );
}

/** French message for one line after the check, or nothing when all is fine. */
function describe(r: CartCheckResult, old: CartItem, now: CartItem): LineMessage | undefined {
  switch (r.problem) {
    case 'gone':
      return { text: 'Cette annonce n’existe plus. Retirez-la du panier.', blocking: true };
    case 'out_of_stock':
      return { text: 'Épuisé. Retirez cet article pour continuer.', blocking: true };
    case 'dates_taken':
      return {
        text: `Déjà réservé le ${formatDayShort(r.conflicts?.[0] ?? now.rental?.startDate ?? today())}. Choisissez d’autres dates.`,
        blocking: true,
      };
    case 'invalid_dates':
      return { text: 'Ces dates ne sont plus possibles. Choisissez de nouvelles dates.', blocking: true };
    case 'not_enough_stock':
      if (now.maxQuantity == null || now.maxQuantity <= 0) {
        return { text: 'Épuisé. Retirez cet article pour continuer.', blocking: true };
      }
      return { text: `Quantité réduite à ${now.quantity} : c’est tout le stock disponible.`, blocking: false };
    default:
      break;
  }
  if (r.priceChanged) {
    const was = old.rental ? old.rental.pricePerDay : old.price;
    const unit = old.rental ? ' / jour' : '';
    return {
      text: `Prix mis à jour : ${formatFcfa(r.price)}${unit} (avant ${formatFcfa(was)}${unit}).`,
      blocking: false,
    };
  }
  return undefined;
}

type Group = { shopId: string; shopName: string; lines: CartItem[] };

/** One card per shop: each shop delivers or hands over its own items. */
function groupByShop(lines: CartItem[]): Group[] {
  const groups: Group[] = [];
  for (const i of lines) {
    const g = groups.find((x) => x.shopId === i.shopId);
    if (g) g.lines.push(i);
    else groups.push({ shopId: i.shopId, shopName: i.shopName, lines: [i] });
  }
  return groups;
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant={strong ? 'bodyStrong' : 'secondary'} color={colors.text.body}>
        {label}
      </AppText>
      <AppText
        variant={strong ? 'cardTitle' : 'secondaryStrong'}
        color={muted ? colors.text.muted : colors.text.primary}
        style={strong ? styles.strong : undefined}>
        {value}
      </AppText>
    </View>
  );
}

function UndoRow({ removed, onUndo }: { removed: { line: CartItem }; onUndo: () => void }) {
  return (
    <View style={styles.undo} accessibilityLiveRegion="polite">
      <AppText variant="secondary" color={colors.text.inverse} style={styles.flex} numberOfLines={2}>
        {`« ${removed.line.name} » retiré du panier.`}
      </AppText>
      <Pressable accessibilityRole="button" hitSlop={10} onPress={onUndo}>
        <AppText variant="secondaryStrong" color={colors.brand.onNavyMuted}>
          Annuler
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  content: { paddingHorizontal: space.gutter, paddingBottom: space.xxl, gap: space.lg },
  separated: { borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  strong: { fontFamily: fontFamily.bold },
  divider: { height: 1, backgroundColor: colors.border.default },
  deposit: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  noticeDanger: { backgroundColor: colors.surface.card, borderColor: colors.status.danger },
  noticeInfo: { backgroundColor: colors.brand.navyTint, borderColor: colors.brand.navyTint },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.text.primary,
  },
});
