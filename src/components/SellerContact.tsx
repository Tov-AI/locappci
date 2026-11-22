import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { api, ApiError, type ContactUnlock, type Shop } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { OptionCard } from '@/components/OptionCard';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { TransferSheet } from '@/components/TransferSheet';
import { useAccount } from '@/data/account';
import { rememberContactUnlock, useContactUnlock } from '@/data/contactUnlocks';
import { useAppConfig } from '@/data/queries';
import { colors, radius, space } from '@/theme';
import { formatFcfa } from '@/utils/format';
import { formatPhone, normalizePhone, PHONE_HELP, PHONE_PLACEHOLDER } from '@/utils/phone';

type Props = {
  shop?: Shop;
  /** Pre-filled WhatsApp message once the contact is unlocked, e.g. about the product on screen. */
  message: string;
};

type Method = 'wave' | 'orange_money';

const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * « Obtenir les coordonnées » under the seller row (client, 21 Nov: seller contacts are paid).
 * Nothing shown until the owner sets a price (section 8). Then, by state:
 * none → pay the fee; asked → finish paying; reference sent → « en vérification »; paid → the seller's WhatsApp.
 */
export function SellerContact({ shop, message }: Props) {
  const fee = useAppConfig().data?.contactFee ?? null;
  const unlock = useContactUnlock(shop?.id);
  const account = useAccount();

  const [formOpen, setFormOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<Method>('wave');
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    form?: string;
  }>({});
  const [sending, setSending] = useState(false);
  // One key per form opening: a double tap or a retry never pays twice.
  const key = useMemo(() => newKey(), [formOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (formOpen && account) {
      setName((n) => n || account.name);
      setPhone((p) => p || (account.phone ? `+${account.phone}` : ''));
    }
  }, [formOpen, account]);

  // While LOCAPPCI checks the transfer, ask again each time the page opens.
  const waiting = unlock?.status === 'awaiting_confirmation' || unlock?.status === 'pending_payment';
  const fresh = useQuery({
    queryKey: ['contactUnlock', unlock?.id],
    queryFn: () => api.getContactUnlock(unlock!.id),
    enabled: !!unlock && waiting,
    staleTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (fresh.data) rememberContactUnlock(fresh.data);
  }, [fresh.data]);

  if (!shop) return null;
  const contact = unlock?.status === 'paid' ? unlock.contact?.whatsapp : null;

  if (contact) {
    return (
      <View style={styles.box}>
        <AppText variant="meta" color={colors.text.muted}>
          WhatsApp du vendeur
        </AppText>
        <AppText variant="bodyStrong" selectable>
          {formatPhone(contact)}
        </AppText>
        <Button
          label="Écrire sur WhatsApp"
          icon="message-circle"
          variant="outline"
          onPress={() =>
            Linking.openURL(`https://wa.me/${contact}?text=${encodeURIComponent(message)}`).catch(() =>
              showToast('WhatsApp n’est pas installé sur ce téléphone.'),
            )
          }
        />
      </View>
    );
  }
  if (!fee && !unlock) return null;

  const submitForm = async () => {
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Indiquez votre nom.';
    const p = normalizePhone(phone);
    if (!p) next.phone = PHONE_HELP;
    setErrors(next);
    if (next.name || next.phone || !p) return;
    setSending(true);
    try {
      const u = await api.createContactUnlock({
        idempotencyKey: key,
        shopId: shop.id,
        customer: { name: name.trim(), phone: p },
        paymentMethod: method,
      });
      rememberContactUnlock(u);
      setFormOpen(false);
      setPayOpen(true);
    } catch (e) {
      setErrors({
        form: e instanceof ApiError ? e.message : 'Un problème est survenu. Réessayez.',
      });
    } finally {
      setSending(false);
    }
  };

  const submitReference = async (reference: string) => {
    if (!unlock) return 'Demande introuvable. Réessayez.';
    try {
      const u = await api.submitContactUnlockReference(unlock.id, reference);
      rememberContactUnlock(u);
      setPayOpen(false);
      showToast(
        u.status === 'paid'
          ? 'Merci ! Les coordonnées du vendeur sont affichées.'
          : 'Merci ! LOCAPPCI vérifie le transfert. Les coordonnées s’afficheront ici.',
      );
      return undefined;
    } catch (e) {
      return e instanceof ApiError ? e.message : 'Envoi impossible. Réessayez.';
    }
  };

  const label =
    unlock?.status === 'awaiting_confirmation'
      ? 'Coordonnées : paiement en vérification'
      : unlock?.status === 'pending_payment'
        ? `Terminer le paiement (${formatFcfa(unlock.total)})`
        : `Obtenir les coordonnées · ${formatFcfa(fee ?? 0)}`;

  const onPress = () => {
    if (unlock?.status === 'pending_payment') setPayOpen(true);
    else if (unlock?.status === 'awaiting_confirmation') fresh.refetch();
    else setFormOpen(true);
  };

  return (
    <>
      <Button
        label={label}
        icon={unlock?.status === 'awaiting_confirmation' ? 'clock' : 'lock'}
        variant="outline"
        loading={fresh.isFetching && unlock?.status === 'awaiting_confirmation'}
        onPress={onPress}
      />

      <BottomSheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title="Coordonnées du vendeur"
        footer={<Button label={`Payer ${formatFcfa(fee ?? 0)}`} icon="lock" loading={sending} onPress={submitForm} />}>
        <AppText variant="secondary" color={colors.text.body}>
          {`Recevez le WhatsApp de « ${shop.name} » pour discuter directement. LOCAPPCI vérifie votre paiement puis affiche le numéro ici.`}
        </AppText>
        <TextField
          label="Nom et prénom"
          value={name}
          onChangeText={(v) => (setName(v), setErrors((e) => ({ ...e, name: undefined })))}
          error={errors.name}
          autoComplete="name"
        />
        <TextField
          label="Téléphone"
          value={phone}
          placeholder={PHONE_PLACEHOLDER}
          keyboardType="phone-pad"
          onChangeText={(v) => (setPhone(v), setErrors((e) => ({ ...e, phone: undefined })))}
          error={errors.phone}
        />
        <OptionCard label="Wave" selected={method === 'wave'} onSelect={() => setMethod('wave')} />
        <OptionCard
          label="Orange Money"
          selected={method === 'orange_money'}
          onSelect={() => setMethod('orange_money')}
        />
        {errors.form ? (
          <AppText variant="secondary" color={colors.status.danger}>
            {errors.form}
          </AppText>
        ) : null}
      </BottomSheet>

      {unlock && unlock.status === 'pending_payment' && unlock.transferTo ? (
        <TransferSheet
          visible={payOpen}
          onClose={() => setPayOpen(false)}
          order={unlock as Pick<ContactUnlock, 'paymentMethod' | 'total' | 'transferTo'>}
          note={`Coordonnées de « ${unlock.shopName} ». LOCAPPCI vérifie le transfert puis affiche le numéro.`}
          onSubmit={submitReference}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.field,
  },
});
