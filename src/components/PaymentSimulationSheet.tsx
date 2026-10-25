import { StyleSheet, View } from 'react-native';

import type { PaymentMethod } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { colors, space } from '@/theme';
import { formatFcfa } from '@/utils/format';

export type SimulatedOutcome = 'paid' | 'payment_failed' | 'cancelled';

type Props = {
  visible: boolean;
  method: PaymentMethod;
  amount: number;
  onResult: (outcome: SimulatedOutcome) => void;
};

/**
 * Mock only. Stands in for the Wave / Orange Money app until the real hand-off (Feature 15).
 * Lets us test success, refusal and "closed without paying" on the phone.
 */
export function PaymentSimulationSheet({ visible, method, amount, onResult }: Props) {
  const provider = method === 'wave' ? 'Wave' : 'Orange Money';
  return (
    <BottomSheet
      visible={visible}
      onClose={() => onResult('cancelled')}
      title={`${provider} (simulation)`}
      footer={
        <View style={styles.buttons}>
          <Button label="Paiement réussi" icon="check" onPress={() => onResult('paid')} />
          <Button label="Paiement refusé" variant="outline" icon="x" onPress={() => onResult('payment_failed')} />
        </View>
      }>
      <AppText variant="body" color={colors.text.body}>
        {`Dans la vraie appli, ${provider} s’ouvre ici pour valider le paiement de ${formatFcfa(amount)}.`}
      </AppText>
      <AppText variant="meta" color={colors.text.muted}>
        Données d’exemple : choisissez le résultat à tester. Fermer sans choisir revient à abandonner le paiement.
      </AppText>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: space.sm },
});
