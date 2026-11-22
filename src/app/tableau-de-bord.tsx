import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { api, ApiError, type ManagerDecision, type ManagerPeriod, type ManagerQueue } from '@/api';
import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { useAccount } from '@/data/account';
import { colors, radius, space } from '@/theme';
import { formatFcfa } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';
import { formatPhone } from '@/utils/phone';

const DASHBOARD = ['managerDashboard'] as const;
const QUEUE = ['managerQueue'] as const;

type Refusal = { kind: 'seller' | 'article'; id: string; title: string } | null;

/**
 * Tableau de bord (client, 21 Nov): LOCAPPCI's figures and everything waiting for the owner, with Valider / Refuser.
 * Only for the accounts named in Outils → LOCAPPCI API, section 11.
 */
export default function TableauDeBordScreen() {
  const goBack = useGoBack();
  const account = useAccount();
  const queryClient = useQueryClient();
  const enabled = !!account?.manager;
  const dashboard = useQuery({ queryKey: DASHBOARD, queryFn: () => api.getManagerDashboard(), enabled, staleTime: 0 });
  const queue = useQuery({ queryKey: QUEUE, queryFn: () => api.getManagerQueue(), enabled, staleTime: 0 });
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [busy, setBusy] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; title: string } | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: DASHBOARD });
    queryClient.invalidateQueries({ queryKey: QUEUE });
  };

  const run = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await action();
      showToast(done);
      refresh();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Un problème est survenu. Réessayez.');
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const decide = (kind: 'payment' | 'seller' | 'article', id: string, d: ManagerDecision) => {
    const call =
      kind === 'payment'
        ? api.decidePayment(id, d)
        : kind === 'seller'
          ? api.decideSeller(id, d)
          : api.decideArticle(id, d);
    const done =
      d.decision === 'approve'
        ? { payment: 'Paiement validé.', seller: 'Boutique validée.', article: 'Article validé.' }[kind]
        : { payment: 'Paiement refusé.', seller: 'Demande refusée.', article: 'Article refusé.' }[kind];
    return run(`${kind}-${id}-${d.decision}`, () => call, done);
  };

  const showPhoto = async (id: string, title: string) => {
    setBusy(`photo-${id}`);
    try {
      const p = await api.getSellerPhoto(id);
      setPhoto({ uri: `data:${p.mime};base64,${p.base64}`, title });
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Photo indisponible.');
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <View style={styles.header}>
      <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={goBack} />
      <AppText variant="headerTitle" accessibilityRole="header" style={styles.flex}>
        Tableau de bord
      </AppText>
      {enabled ? <IconButton icon="refresh-cw" accessibilityLabel="Actualiser" bordered onPress={refresh} /> : null}
    </View>
  );

  if (!enabled) {
    return (
      <Screen>
        {header}
        <AppText variant="secondary" color={colors.text.muted}>
          Réservé au propriétaire de LOCAPPCI.
        </AppText>
      </Screen>
    );
  }

  const d = dashboard.data;
  const q = queue.data;
  const p: ManagerPeriod | undefined = d ? d[range] : undefined;

  return (
    <Screen>
      {header}

      {dashboard.isError ? (
        <SectionCard>
          <AppText variant="secondary">Impossible de charger les chiffres.</AppText>
          <Button label="Réessayer" variant="outline" onPress={refresh} />
        </SectionCard>
      ) : null}

      {d && p ? (
        <>
          <View style={styles.row}>
            <Chip label="7 derniers jours" active={range === 'week'} onPress={() => setRange('week')} />
            <Chip label="30 derniers jours" active={range === 'month'} onPress={() => setRange('month')} />
          </View>
          <View style={styles.grid}>
            <Metric
              label="Gains LOCAPPCI"
              value={formatFcfa(p.earnings)}
              hint={`Commission ${d.commissionRate} % + coordonnées`}
              wide
            />
            <Metric label="Ventes payées" value={String(p.sales.count)} hint={formatFcfa(p.sales.total)} />
            <Metric label="Commission" value={formatFcfa(p.sales.commission)} />
            <Metric label="Coordonnées vendues" value={String(p.contacts.count)} hint={formatFcfa(p.contacts.total)} />
            <Metric label="Nouveaux acheteurs" value={String(p.newBuyers)} />
            <Metric label="Nouvelles boutiques" value={String(p.newShops)} />
            <Metric label="Acheteurs (total)" value={String(d.totals.buyers)} />
            <Metric label="Vendeurs (total)" value={String(d.totals.sellers)} />
          </View>
        </>
      ) : dashboard.isPending ? (
        <AppText variant="meta" color={colors.text.muted}>
          Chargement…
        </AppText>
      ) : null}

      {q ? (
        <>
          <Payments items={q.payments} busy={busy} onDecide={(id, decision) => decide('payment', id, { decision })} />
          <SectionCard title={`Demandes vendeur (${q.sellers.length})`}>
            {q.sellers.length === 0 ? <Empty /> : null}
            {q.sellers.map((s) => (
              <View key={s.id} style={styles.item}>
                <AppText variant="bodyStrong">{s.shopName}</AppText>
                <AppText variant="meta" color={colors.text.muted}>
                  {[s.commune, s.accountName].filter(Boolean).join(' · ')}
                </AppText>
                <AppText variant="secondary">
                  {`WhatsApp ${s.whatsapp ? formatPhone(s.whatsapp) : '—'} · code attendu `}
                  <AppText variant="secondaryStrong">{s.verifyCode}</AppText>
                </AppText>
                {s.description ? (
                  <AppText variant="meta" color={colors.text.muted} numberOfLines={3}>
                    {s.description}
                  </AppText>
                ) : null}
                {s.hasPhoto ? (
                  <Button
                    label="Voir la pièce d’identité"
                    icon="eye"
                    variant="outline"
                    loading={busy === `photo-${s.id}`}
                    onPress={() => showPhoto(s.id, s.shopName)}
                  />
                ) : null}
                <Decision
                  busyKey={busy}
                  prefix={`seller-${s.id}`}
                  onApprove={() => decide('seller', s.id, { decision: 'approve' })}
                  onRefuse={() => (setReason(''), setRefusal({ kind: 'seller', id: s.id, title: s.shopName }))}
                />
              </View>
            ))}
          </SectionCard>
          <SectionCard title={`Articles à valider (${q.articles.length})`}>
            {q.articles.length === 0 ? <Empty /> : null}
            {q.articles.map((a) => (
              <View key={a.id} style={styles.item}>
                <View style={styles.articleRow}>
                  {a.photos[0] ? <Image source={{ uri: a.photos[0] }} style={styles.thumb} /> : null}
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={2}>
                      {a.name}
                    </AppText>
                    <AppText variant="meta" color={colors.text.muted}>
                      {`${formatFcfa(a.price)} · ${a.shopName}`}
                    </AppText>
                  </View>
                </View>
                {a.description ? (
                  <AppText variant="meta" color={colors.text.muted} numberOfLines={3}>
                    {a.description}
                  </AppText>
                ) : null}
                <Decision
                  busyKey={busy}
                  prefix={`article-${a.id}`}
                  onApprove={() => decide('article', a.id, { decision: 'approve' })}
                  onRefuse={() => (setReason(''), setRefusal({ kind: 'article', id: a.id, title: a.name }))}
                />
              </View>
            ))}
          </SectionCard>
          <SectionCard title="Signalements récents">
            {q.reports.length === 0 ? <Empty text="Aucun signalement." /> : null}
            {q.reports.map((r, i) => (
              <View key={`${r.at}-${i}`} style={styles.item}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {r.product}
                </AppText>
                <AppText variant="meta" color={colors.status.danger}>
                  {r.reason}
                </AppText>
                {r.details ? (
                  <AppText variant="meta" color={colors.text.muted}>
                    {r.details}
                  </AppText>
                ) : null}
              </View>
            ))}
          </SectionCard>
        </>
      ) : null}

      <BottomSheet
        visible={!!refusal}
        onClose={() => setRefusal(null)}
        title={refusal?.kind === 'seller' ? 'Refuser la boutique' : 'Refuser l’article'}
        footer={
          <Button
            label="Refuser"
            loading={!!busy}
            onPress={() => {
              if (!refusal) return;
              const r = refusal;
              setRefusal(null);
              decide(r.kind, r.id, { decision: 'refuse', reason: reason.trim() });
            }}
          />
        }>
        <AppText variant="secondary">{refusal?.title}</AppText>
        <TextField
          label="Motif (le vendeur le verra)"
          placeholder={refusal?.kind === 'seller' ? 'Ex. : photo de la pièce floue' : 'Ex. : photos trop sombres'}
          value={reason}
          onChangeText={setReason}
          multiline
        />
      </BottomSheet>

      <BottomSheet visible={!!photo} onClose={() => setPhoto(null)} title={photo?.title ?? ''}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.idPhoto} accessibilityLabel="Pièce d’identité" />
        ) : null}
        <AppText variant="meta" color={colors.text.muted}>
          La photo est supprimée après votre décision.
        </AppText>
      </BottomSheet>
    </Screen>
  );
}

function Payments({
  items,
  busy,
  onDecide,
}: {
  items: ManagerQueue['payments'];
  busy: string | null;
  onDecide: (id: string, decision: 'approve' | 'refuse') => void;
}) {
  return (
    <SectionCard title={`Paiements à vérifier (${items.length})`}>
      {items.length === 0 ? <Empty /> : null}
      {items.map((p) => (
        <View key={p.id} style={styles.item}>
          <View style={styles.articleRow}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{formatFcfa(p.total)}</AppText>
              <AppText variant="meta" color={colors.text.muted}>
                {`${p.number} · ${p.label}`}
              </AppText>
            </View>
            <Tag
              label={p.kind === 'contact' ? 'Coordonnées' : 'Commande'}
              tone={p.kind === 'contact' ? 'navy' : 'orange'}
            />
          </View>
          <AppText variant="secondary">
            {`${p.method === 'orange_money' ? 'Orange Money' : 'Wave'} · réf. `}
            <AppText variant="secondaryStrong" selectable>
              {p.reference}
            </AppText>
          </AppText>
          <AppText variant="meta" color={colors.text.muted}>
            {`${p.customerName}${p.customerPhone ? ` · ${formatPhone(p.customerPhone)}` : ''}`}
          </AppText>
          <AppText variant="meta" color={colors.text.muted}>
            Vérifiez sur votre téléphone Wave / Orange Money que ce transfert est bien arrivé.
          </AppText>
          <Decision
            busyKey={busy}
            prefix={`payment-${p.id}`}
            approveLabel="Transfert reçu"
            refuseLabel="Pas reçu"
            onApprove={() => onDecide(p.id, 'approve')}
            onRefuse={() => onDecide(p.id, 'refuse')}
          />
        </View>
      ))}
    </SectionCard>
  );
}

function Decision({
  busyKey,
  prefix,
  onApprove,
  onRefuse,
  approveLabel = 'Valider',
  refuseLabel = 'Refuser',
}: {
  busyKey: string | null;
  prefix: string;
  onApprove: () => void;
  onRefuse: () => void;
  approveLabel?: string;
  refuseLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <Button
        label={approveLabel}
        icon="check"
        style={styles.flex}
        loading={busyKey === `${prefix}-approve`}
        disabled={!!busyKey}
        onPress={onApprove}
      />
      <Button
        label={refuseLabel}
        icon="x"
        variant="outline"
        style={styles.flex}
        loading={busyKey === `${prefix}-refuse`}
        disabled={!!busyKey}
        onPress={onRefuse}
      />
    </View>
  );
}

function Metric({ label, value, hint, wide }: { label: string; value: string; hint?: string; wide?: boolean }) {
  return (
    <View style={[styles.metric, wide && styles.metricWide]}>
      <AppText variant="meta" color={colors.text.muted}>
        {label}
      </AppText>
      <AppText variant="headerTitle">{value}</AppText>
      {hint ? (
        <AppText variant="meta" color={colors.text.muted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

function Empty({ text = 'Rien à valider.' }: { text?: string }) {
  return (
    <AppText variant="meta" color={colors.text.muted}>
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: {
    flexBasis: '48%',
    flexGrow: 1,
    gap: 2,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  metricWide: { flexBasis: '100%' },
  item: { gap: space.xs, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: colors.border.default },
  articleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md },
  idPhoto: { width: '100%', height: 260, borderRadius: radius.lg, resizeMode: 'contain' },
  flex: { flex: 1 },
});
