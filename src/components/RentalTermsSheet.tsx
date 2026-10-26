import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RentalProduct } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { colors, space } from '@/theme';
import { formatDays } from '@/utils/dates';
import { formatFcfa } from '@/utils/format';

type Props = {
  visible: boolean;
  onClose: () => void;
  product: RentalProduct;
};

/**
 * "Conditions de location": product data + the client's rules (deposit online or cash at pickup,
 * broken item charged, late return penalty). Penalty amounts: to confirm with the client.
 */
export function RentalTermsSheet({ visible, onClose, product: p }: Props) {
  const lines: { icon: ComponentProps<typeof Feather>['name']; text: string }[] = [
    {
      icon: 'calendar',
      text:
        p.minDays === p.maxDays
          ? `Durée : ${formatDays(p.minDays)}.`
          : `Durée : de ${formatDays(p.minDays)} à ${formatDays(p.maxDays)}.`,
    },
    { icon: 'tag', text: `Prix : ${formatFcfa(p.pricePerDay)} par jour.` },
    {
      icon: 'lock',
      text: `Caution : ${formatFcfa(p.deposit)}, payée en plus (en ligne ou en espèces au retrait) et rendue au retour du matériel en bon état.`,
    },
    { icon: 'alert-triangle', text: 'Matériel cassé : il est facturé.' },
    { icon: 'clock', text: 'Retour en retard : une pénalité est appliquée.' },
    { icon: 'credit-card', text: 'Pièce d’identité demandée au retrait.' },
    { icon: 'check-square', text: 'Vérifiez le matériel avec le loueur au retrait et au retour.' },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Conditions de location"
      footer={<Button label="J’ai compris" onPress={onClose} />}>
      <View style={styles.list}>
        {lines.map((l) => (
          <View key={l.text} style={styles.line}>
            <Feather name={l.icon} size={18} color={colors.brand.navy} />
            <AppText variant="secondary" color={colors.text.body} style={styles.text}>
              {l.text}
            </AppText>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  line: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  text: { flex: 1 },
});
