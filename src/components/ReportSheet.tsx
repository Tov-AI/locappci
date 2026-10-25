import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ReportReason } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { OptionCard } from '@/components/OptionCard';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { useOnline } from '@/data/online';
import { useReportProduct } from '@/data/queries';
import { colors, space } from '@/theme';

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'scam', label: 'Arnaque ou demande de paiement suspect' },
  { id: 'forbidden', label: 'Produit interdit ou dangereux' },
  { id: 'wrong_info', label: 'Prix, photos ou description trompeurs' },
  { id: 'other', label: 'Autre raison' },
];

const MAX_DETAILS = 500;

type Props = {
  visible: boolean;
  onClose: () => void;
  productId: string;
};

/** "Signaler cette annonce": pick a reason, add a note if needed, send to the LOCAPPCI team. */
export function ReportSheet({ visible, onClose, productId }: Props) {
  const online = useOnline();
  const report = useReportProduct();
  const [reason, setReason] = useState<ReportReason | undefined>();
  const [details, setDetails] = useState('');

  // Start empty each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setReason(undefined);
    setDetails('');
    report.reset();
    // Only when the sheet opens: `report` changes on every render.
  }, [visible]);

  const needsDetails = reason === 'other' && details.trim().length === 0;

  const send = () => {
    if (!reason) return;
    report.mutate(
      { productId, report: { reason, details: details.trim() || undefined } },
      {
        onSuccess: () => {
          onClose();
          showToast('Merci, notre équipe va vérifier cette annonce.');
        },
      },
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Signaler cette annonce"
      footer={
        <View style={styles.footer}>
          {!online ? (
            <AppText variant="meta" color={colors.text.muted}>
              Connexion nécessaire pour envoyer le signalement.
            </AppText>
          ) : report.isError ? (
            <AppText variant="meta" color={colors.status.danger} accessibilityRole="alert">
              {report.error.message}
            </AppText>
          ) : null}
          <Button
            label="Envoyer le signalement"
            loading={report.isPending}
            disabled={!online || !reason || needsDetails}
            onPress={send}
          />
        </View>
      }>
      <View style={styles.reasons} accessibilityRole="radiogroup">
        {REASONS.map((r) => (
          <OptionCard key={r.id} label={r.label} selected={reason === r.id} onSelect={() => setReason(r.id)} />
        ))}
      </View>
      <TextField
        label={reason === 'other' ? 'Expliquez-nous (obligatoire)' : 'Détails (facultatif)'}
        placeholder="Ce qui ne va pas avec cette annonce"
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={MAX_DETAILS}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  reasons: { gap: space.sm },
  footer: { gap: space.sm },
});
