import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BottomActionBar } from '@/components/BottomActionBar';
import { Button } from '@/components/Button';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { LoginSheet } from '@/components/LoginSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { ProductPhoto } from '@/components/ProductPhoto';
import { useAccount } from '@/data/account';
import { useSavedCustomer } from '@/data/customer';
import { useOnline } from '@/data/online';
import { useCities, useLocappciWhatsapp, useSendRentalRequest } from '@/data/queries';
import {
  isPastStart,
  markRequestSent,
  removeRequestLine,
  restoreRequestLine,
  useLastSentRequest,
  useRequestLines,
  type RequestLine,
} from '@/data/rentalRequest';
import { colors, radius, space } from '@/theme';
import { addDays, formatDayCompact, formatDays, formatDayShort } from '@/utils/dates';
import { formatFcfa } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';
import { formatPhone, normalizePhone, PHONE_HELP, PHONE_PLACEHOLDER } from '@/utils/phone';

type Errors = { name?: string; phone?: string; whatsapp?: string };
const MAX_MESSAGE = 500;
const formatUnits = (n: number) => `${n} unité${n > 1 ? 's' : ''}`;

/** Same list and contact → same key: a retry never sends the requests twice. */
function requestKey(lines: RequestLine[], phone: string) {
  const text = phone + lines.map((l) => `${l.productId}|${l.startDate}|${l.days}|${l.quantity}|${l.cityId}`).join(';');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `req-${h.toString(36)}-${lines.length}`;
}

/** WhatsApp follows the same rule as the phone: Ivorian, or another country with + / 00. */
const normalizeWhatsapp = normalizePhone;

/**
 * Ma demande de location (Feature 14), like the website's page: the rental items the person wants,
 * their contact details, then "Envoyer aux loueurs" (needs an account, as on the site)
 * or "Envoyer sur WhatsApp" to LOCAPPCI. The loueurs answer; nothing is paid here.
 */
export default function DemandeLocationScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const online = useOnline();
  const lines = useRequestLines();
  const lastSent = useLastSentRequest();
  const account = useAccount();
  const customer = useSavedCustomer();
  const cities = useCities();
  const locappciWhatsapp = useLocappciWhatsapp();
  const send = useSendRentalRequest();

  const [name, setName] = useState(account?.name ?? customer?.name ?? '');
  const [phone, setPhone] = useState(() => {
    const p = account?.phone || customer?.phone;
    return p ? formatPhone(p) : '';
  });
  const [whatsapp, setWhatsapp] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loginOpen, setLoginOpen] = useState(false);
  const [askSentOpen, setAskSentOpen] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [removed, setRemoved] = useState<{ line: RequestLine; index: number } | undefined>();

  const cityNames = useMemo(() => new Map((cities.data ?? []).map((c) => [c.id, c.name])), [cities.data]);
  const past = lines.filter((l) => isPastStart(l));
  const unpriced = lines.some((l) => l.pricePerDay === 0);
  const estimate = lines.reduce((sum, l) => sum + l.pricePerDay * l.days * l.quantity, 0);

  /** Checks the contact fields; returns them ready to send, or null with the errors shown. */
  const contact = () => {
    const p = normalizePhone(phone);
    const w = whatsapp.trim() ? normalizeWhatsapp(whatsapp) : undefined;
    const next: Errors = {
      name: name.trim().length < 2 ? 'Indiquez votre nom.' : undefined,
      phone: p ? undefined : PHONE_HELP,
      whatsapp: w === null ? 'Numéro WhatsApp invalide (ex. 07 00 00 00 00 ou +33 6…).' : undefined,
    };
    setErrors(next);
    if (next.name || next.phone || next.whatsapp || !p) return null;
    if (past.length > 0) {
      setNotice('Une date de début est passée : modifiez-la avant d’envoyer.');
      return null;
    }
    return { name: name.trim(), phone: p, whatsapp: w && w !== p ? w : undefined, message: message.trim() || undefined };
  };

  const sendToLoueurs = () => {
    setNotice(undefined);
    const c = contact();
    if (!c) return;
    if (!account) {
      setNotice('Connectez-vous pour envoyer votre demande aux loueurs, ou envoyez-la sur WhatsApp.');
      setLoginOpen(true);
      return;
    }
    send.mutate(
      {
        idempotencyKey: requestKey(lines, c.phone),
        contact: c,
        items: lines.map(({ productId, startDate, days, quantity, cityId }) => ({ productId, startDate, days, quantity, cityId })),
      },
      {
        onSuccess: (receipt) => {
          markRequestSent({
            reference: receipt.reference,
            sentAt: new Date().toISOString(),
            count: receipt.sent.length,
            channel: 'loueur',
          });
          if (receipt.skipped.length > 0) {
            showToast(`${receipt.skipped.length} matériel(s) ne sont plus proposés et n’ont pas été envoyés.`);
          }
        },
        onError: (e) => setNotice(e.message),
      },
    );
  };

  const whatsappText = (c: { name: string; phone: string; whatsapp?: string; message?: string }) => {
    const parts = ['Bonjour LOCAPPCI, voici ma demande de location :', ''];
    lines.forEach((l, i) => {
      parts.push(`${i + 1}. ${l.name}${l.shopName ? ` (${l.shopName})` : ''}`);
      parts.push(`   ${formatUnits(l.quantity)}, ${formatDays(l.days)} à partir du ${formatDayShort(l.startDate)}`);
      parts.push(`   Commune : ${cityNames.get(l.cityId) ?? l.cityId}`);
      parts.push(`   Prix indiqué : ${l.pricePerDay > 0 ? `${formatFcfa(l.pricePerDay)} / jour` : 'à confirmer'}`);
    });
    parts.push('', `Nom : ${c.name}`, `Téléphone : ${formatPhone(c.phone)}`);
    if (c.whatsapp) parts.push(`WhatsApp : +${c.whatsapp}`);
    if (c.message) parts.push(`Message : ${c.message}`);
    return parts.join('\n').replace(/ /g, ' ');
  };

  const sendOnWhatsapp = () => {
    setNotice(undefined);
    if (!locappciWhatsapp) {
      setNotice('Le WhatsApp LOCAPPCI n’est pas disponible pour le moment. Envoyez votre demande aux loueurs.');
      return;
    }
    const c = contact();
    if (!c) return;
    const url = `https://wa.me/${locappciWhatsapp}?text=${encodeURIComponent(whatsappText(c))}`;
    Linking.openURL(url)
      .then(() => setAskSentOpen(true))
      .catch(() => showToast('WhatsApp n’a pas pu s’ouvrir sur ce téléphone.'));
  };

  const remove = (productId: string) => {
    const r = removeRequestLine(productId);
    if (r) setRemoved(r);
  };

  if (lines.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={styles.fill}>
        <Header onBack={goBack} />
        {lastSent ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.sent} accessibilityRole="summary">
              <Feather name="check-circle" size={28} color={colors.brand.green} />
              <AppText variant="cardTitle">
                {lastSent.channel === 'loueur' ? 'Demande envoyée aux loueurs' : 'Demande envoyée sur WhatsApp'}
              </AppText>
              <AppText variant="secondary" color={colors.text.body}>
                {lastSent.channel === 'loueur'
                  ? `${lastSent.count > 1 ? `Vos ${lastSent.count} demandes ont été transmises` : 'Votre demande a été transmise'} (réf.\u00A0${lastSent.reference}). Les loueurs vous contactent par téléphone ou WhatsApp pour confirmer la disponibilité et le prix.`
                  : 'LOCAPPCI vous répond sur WhatsApp pour confirmer la disponibilité et le prix.'}
              </AppText>
            </View>
            {removed ? <UndoRow line={removed.line} onUndo={() => (restoreRequestLine(removed), setRemoved(undefined))} /> : null}
            <Button label="Voir d’autres matériels" variant="outline" onPress={() => router.dismissTo('/')} />
          </ScrollView>
        ) : (
          <>
            {removed ? (
              <View style={styles.content}>
                <UndoRow line={removed.line} onUndo={() => (restoreRequestLine(removed), setRemoved(undefined))} />
              </View>
            ) : null}
            <EmptyState
              icon="calendar"
              title="Votre demande est vide"
              message="Choisissez du matériel en location, puis « Ajouter à ma demande »."
              actionLabel="Voir la location"
              onAction={() => router.push({ pathname: '/recherche', params: { universe: 'location', t: String(Date.now()) } })}
            />
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <Header onBack={goBack} />
      {!online ? <OfflineBanner message="Hors connexion. Votre demande reste enregistrée ; l’envoi demande du réseau." /> : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="meta" color={colors.text.body}>
            Les loueurs vous confirment la disponibilité et le prix. Rien n’est payé dans l’appli.
          </AppText>

          {notice ? (
            <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Feather name="alert-circle" size={18} color={colors.status.danger} />
              <AppText variant="secondary" style={styles.flex}>
                {notice}
              </AppText>
            </View>
          ) : null}

          <SectionCard title={`Matériel (${lines.length})`}>
            {lines.map((l, n) => (
              <RequestRow
                key={l.productId}
                separated={n > 0}
                line={l}
                cityName={cityNames.get(l.cityId) ?? ''}
                past={isPastStart(l)}
                onOpen={() => router.push(`/produit/${l.productId}`)}
                onRemove={() => remove(l.productId)}
              />
            ))}
            {removed ? <UndoRow line={removed.line} onUndo={() => (restoreRequestLine(removed), setRemoved(undefined))} /> : null}
          </SectionCard>

          <SectionCard title="Vos coordonnées">
            <AppText variant="meta" color={colors.text.muted}>
              Les loueurs vous contactent à ce numéro.
            </AppText>
            <TextField
              label="Nom et prénom"
              placeholder="Aya Koné"
              value={name}
              onChangeText={(v) => (setName(v), setErrors((e) => ({ ...e, name: undefined })))}
              autoComplete="name"
              textContentType="name"
              error={errors.name}
            />
            <TextField
              label="Téléphone"
              placeholder={PHONE_PLACEHOLDER}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(v) => (setPhone(v), setErrors((e) => ({ ...e, phone: undefined })))}
              autoComplete="tel"
              textContentType="telephoneNumber"
              error={errors.phone}
            />
            <TextField
              label="WhatsApp (si différent)"
              placeholder="Facultatif"
              keyboardType="phone-pad"
              value={whatsapp}
              onChangeText={(v) => (setWhatsapp(v), setErrors((e) => ({ ...e, whatsapp: undefined })))}
              error={errors.whatsapp}
            />
            <TextField
              label="Message (facultatif)"
              placeholder="Livraison souhaitée, horaires, précisions…"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={MAX_MESSAGE}
            />
          </SectionCard>

          {!account ? (
            <AppText variant="meta" color={colors.text.muted}>
              Pour envoyer aux loueurs, connectez-vous à votre compte LOCAPPCI. Sans compte, envoyez votre demande sur WhatsApp.
            </AppText>
          ) : null}
        </ScrollView>

        <BottomActionBar
          summary={`${lines.length} matériel${lines.length > 1 ? 's' : ''}`}
          total={estimate > 0 ? `≈ ${formatFcfa(estimate)}${unpriced ? ' +' : ''}` : 'Prix à confirmer'}>
          <View style={styles.sendButtons}>
            <Button label="Envoyer aux loueurs" loading={send.isPending} disabled={!online} onPress={sendToLoueurs} />
            <Button label="Envoyer sur WhatsApp LOCAPPCI" icon="message-circle" variant="outline" onPress={sendOnWhatsapp} />
          </View>
        </BottomActionBar>
      </KeyboardAvoidingView>

      <LoginSheet visible={loginOpen} onClose={() => setLoginOpen(false)} />
      <ConfirmSheet
        visible={askSentOpen}
        onClose={() => setAskSentOpen(false)}
        title="Message envoyé ?"
        message="Si vous avez bien envoyé le message sur WhatsApp, nous vidons votre demande. Sinon, elle reste enregistrée."
        confirmLabel="Oui, c’est envoyé"
        onConfirm={() => {
          setAskSentOpen(false);
          markRequestSent({ reference: '', sentAt: new Date().toISOString(), count: lines.length, channel: 'whatsapp' });
        }}
      />
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={onBack} />
      <AppText variant="headerTitle" accessibilityRole="header">
        Ma demande de location
      </AppText>
    </View>
  );
}

function RequestRow({
  line: l,
  cityName,
  past,
  separated,
  onOpen,
  onRemove,
}: {
  line: RequestLine;
  separated: boolean;
  cityName: string;
  past: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const period =
    l.days === 1
      ? `le ${formatDayCompact(l.startDate)}`
      : `du ${formatDayCompact(l.startDate)} au ${formatDayCompact(addDays(l.startDate, l.days - 1))}`;
  return (
    <View style={[styles.line, separated && styles.separated]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Modifier ${l.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.lineTop, pressed && styles.pressed]}>
        <View style={styles.thumb}>
          <ProductPhoto uri={l.coverUrl} iconSize={22} rental />
        </View>
        <View style={styles.flex}>
          <AppText variant="secondaryStrong" numberOfLines={2}>
            {l.name}
          </AppText>
          {l.shopName ? (
            <AppText variant="caption" color={colors.text.muted}>
              {l.shopName}
            </AppText>
          ) : null}
          <AppText variant="meta" color={colors.text.body}>
            {`${formatUnits(l.quantity)} · ${formatDays(l.days)} · ${period}${cityName ? ` · ${cityName}` : ''}`}
          </AppText>
          <AppText variant="bodyStrong">
            {l.pricePerDay > 0 ? `${formatFcfa(l.pricePerDay)} / jour` : 'Prix à confirmer'}
          </AppText>
        </View>
      </Pressable>
      {past ? (
        <View style={styles.lineAlert}>
          <Feather name="alert-circle" size={16} color={colors.status.danger} />
          <AppText variant="meta" color={colors.status.danger} style={styles.flex} accessibilityRole="alert">
            La date de début est passée : touchez le matériel pour la changer.
          </AppText>
        </View>
      ) : null}
      <View style={styles.lineActions}>
        <Pressable accessibilityRole="button" onPress={onOpen} hitSlop={8}>
          <AppText variant="secondaryStrong" color={colors.brand.navy}>
            Modifier
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${l.name}`} onPress={onRemove} hitSlop={8}>
          <AppText variant="secondaryStrong" color={colors.status.danger}>
            Retirer
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function UndoRow({ line, onUndo }: { line: RequestLine; onUndo: () => void }) {
  return (
    <View style={styles.undo} accessibilityLiveRegion="polite">
      <AppText variant="secondary" color={colors.text.inverse} style={styles.flex} numberOfLines={2}>
        {`« ${line.name} » retiré de la demande.`}
      </AppText>
      <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={10}>
        <AppText variant="secondaryStrong" color={colors.brand.onNavyMuted}>
          Annuler
        </AppText>
      </Pressable>
    </View>
  );
}

const THUMB = 64;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.gutter,
    paddingVertical: space.sm,
  },
  content: { padding: space.gutter, paddingTop: space.sm, gap: space.lg, paddingBottom: space.xxl },
  notice: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.status.danger,
    backgroundColor: colors.surface.card,
  },
  sent: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface.card },
  line: { gap: space.sm },
  separated: { borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: space.md },
  sendButtons: { flex: 1, gap: space.sm },
  lineTop: { flexDirection: 'row', gap: space.md },
  pressed: { opacity: 0.7 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.orangeTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lineAlert: { flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' },
  lineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.xl },
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
