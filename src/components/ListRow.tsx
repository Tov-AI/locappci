import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, size, space } from '@/theme';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  /** Small grey line under the label: "Commandes, alertes". */
  hint?: string;
  /** Right side: a tag, a count or a switch. */
  right?: ReactNode;
  onPress?: () => void;
  /** Red text and icon, for "Supprimer mon compte". */
  danger?: boolean;
  /** No chevron (e.g. the row holds a switch). */
  noChevron?: boolean;
};

/** One line of a settings list: icon tile, label, optional hint, right element, chevron. */
export function ListRow({ icon, label, hint, right, onPress, danger = false, noChevron = false }: Props) {
  const fg = danger ? colors.status.danger : colors.text.primary;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.tile}>
        <Feather name={icon} size={18} color={danger ? colors.status.danger : colors.brand.navy} />
      </View>
      <View style={styles.texts}>
        <AppText variant="secondaryStrong" color={fg}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" color={colors.text.muted}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {right}
      {onPress && !noChevron ? <Feather name="chevron-right" size={18} color={colors.text.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm },
  pressed: { opacity: 0.7 },
  tile: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2, minHeight: size.touch - 8, justifyContent: 'center' },
});
