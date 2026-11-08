import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { colors, space } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Extra content between the message and the buttons (e.g. a password field). */
  children?: ReactNode;
};

/** "Are you sure?" sheet with the main action and "Annuler". */
export function ConfirmSheet({ visible, onClose, title, message, confirmLabel, onConfirm, loading, disabled, children }: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <View style={styles.buttons}>
          <Button label={confirmLabel} onPress={onConfirm} loading={loading} disabled={disabled} />
          <Button label="Annuler" variant="outline" onPress={onClose} />
        </View>
      }>
      <AppText variant="body" color={colors.text.body}>
        {message}
      </AppText>
      {children}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ buttons: { gap: space.sm } });
