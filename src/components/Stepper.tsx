import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, size, space } from '@/theme';

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Formats the value, e.g. (n) => `${n} jours`. */
  format?: (value: number) => string;
  /** What is being counted, read aloud: "Durée", "Quantité". */
  accessibilityLabel: string;
};

/** − value + control. Buttons are 44 × 44 and disable at the limits. */
export function Stepper({ value, onChange, min = 1, max = 99, format, accessibilityLabel }: Props) {
  const atMin = value <= min;
  const atMax = value >= max;
  const label = format ? format(value) : String(value);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && !atMax) onChange(value + 1);
        if (e.nativeEvent.actionName === 'decrement' && !atMin) onChange(value - 1);
      }}>
      <StepButton symbol="−" disabled={atMin} onPress={() => onChange(value - 1)} />
      <AppText variant="bodyStrong" style={styles.value}>
        {label}
      </AppText>
      <StepButton symbol="+" disabled={atMax} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function StepButton({ symbol, disabled, onPress }: { symbol: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
      <AppText variant="cardTitle" color={colors.text.primary}>
        {symbol}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  value: { minWidth: 76, textAlign: 'center' },
  button: {
    width: size.touch,
    height: size.touch,
    borderRadius: size.touch / 2,
    borderWidth: 1,
    borderColor: colors.border.input,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.surface.field },
  disabled: { opacity: 0.4 },
});
