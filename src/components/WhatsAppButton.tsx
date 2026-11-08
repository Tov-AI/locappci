import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet } from 'react-native';

import { showToast } from '@/components/Toast';
import { colors, radius, size } from '@/theme';

type Props = {
  /** Digits only, international format, e.g. "2250700000001". */
  number: string;
  /** Who we write to, read aloud: "Écrire à … sur WhatsApp". */
  name: string;
  /** Pre-filled message. */
  message: string;
};

/** 52 × 52 outline button that opens WhatsApp with a ready message (wa.me link). */
export function WhatsAppButton({ number, name, message }: Props) {
  const open = () =>
    Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(message)}`).catch(() =>
      showToast("Impossible d'ouvrir WhatsApp sur ce téléphone."),
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Écrire à ${name} sur WhatsApp`}
      onPress={open}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}>
      <Ionicons name="logo-whatsapp" size={24} color={colors.brand.greenText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: size.button,
    height: size.button,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.brand.navySelected },
});
