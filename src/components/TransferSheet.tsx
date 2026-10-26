import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Order } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radius, space } from '@/theme';
import { formatFcfa } from '@/utils/format';
import { formatCiPhone } from '@/utils/phone';

type Props = {
  visible: boolean;
  onClose: () => void;
  order: Order;
  /** Sends the reference; resolves with an error message, or undefined on success. */
  onSubmit: (reference: string) => Promise<string | undefined>;
};

const PROVIDER = { wave: 'Wave', orange_money: 'Orange Money', cash: '' } as const;

/**
 * v1 payment without merchant accounts: send the amount by Wave / Orange Money transfer
 * to the LOCAPPCI number, then type the transaction reference received by SMS.
 * The team checks the transfer and confirms the order.
 */
export function TransferSheet({ visible, onClose, order, onSubmit }: Props) {
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const provider = PROVIDER[order.paymentMethod];
  const to = order.transferTo;

  useEffect(() => {
    if (visible) setError(undefined);
  }, [visible]);

  const submit = async () => {
    setSending(true);
    const message = await onSubmit(reference);
    setSending(false);
    if (message) setError(message);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Payer avec ${provider}`}
      footer={
        <Button
          label="J’ai payé"
          icon="check"
          loading={sending}
          disabled={reference.trim().length < 6}
          onPress={submit}
        />
      }>
      <View style={styles.box}>
        <Step n={1} text={`Ouvrez ${provider} et envoyez exactement :`} />
        <AppText variant="display" color={colors.brand.navy} style={styles.amount} selectable>
          {formatFcfa(order.total)}
        </AppText>
        <Step n={2} text="Au numéro :" />
        <AppText variant="headerTitle" style={styles.amount} selectable>
          {to ? formatCiPhone(to.number) : '—'}
        </AppText>
        {to ? (
          <AppText variant="meta" color={colors.text.muted} style={styles.center}>
            {to.name}
          </AppText>
        ) : null}
        <Step n={3} text="Recopiez ci-dessous la référence de la transaction reçue par SMS." />
      </View>
      <TextField
        label="Référence de la transaction"
        placeholder="Ex. : T_4G7KQ2M9"
        autoCapitalize="characters"
        autoCorrect={false}
        value={reference}
        onChangeText={(v) => {
          setReference(v);
          setError(undefined);
        }}
        error={error}
      />
      <AppText variant="meta" color={colors.text.muted}>
        {`Commande ${order.number}. LOCAPPCI vérifie le transfert puis confirme votre commande.`}
      </AppText>
    </BottomSheet>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.dot}>
        <AppText variant="caption" color={colors.text.inverse}>
          {String(n)}
        </AppText>
      </View>
      <AppText variant="secondary" color={colors.text.body} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface.field },
  amount: { textAlign: 'center' },
  center: { textAlign: 'center', marginTop: -space.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
