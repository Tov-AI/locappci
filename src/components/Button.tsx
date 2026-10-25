import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, size, space } from '@/theme';

type Variant = 'primary' | 'outline';

type Props = {
  label: string;
  onPress?: () => void;
  /** primary = navy fill (main action). outline = navy border (secondary action). */
  variant?: Variant;
  /** Feather icon shown before the label. */
  icon?: ComponentProps<typeof Feather>['name'];
  /** Shows a spinner and blocks taps while a request runs. */
  loading?: boolean;
  disabled?: boolean;
  /** Hide the label and show the icon only. accessibilityLabel then reads the label aloud. */
  iconOnly?: boolean;
  style?: ViewStyle;
};

/** Primary and outline buttons from the handoff: height 52, radius 14, label 16/700. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  iconOnly = false,
  style,
}: Props) {
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;
  const contentColor = isPrimary ? colors.text.inverse : colors.brand.navy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.outline,
        iconOnly && styles.iconOnly,
        pressed && (isPrimary ? styles.primaryPressed : styles.outlinePressed),
        disabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <View style={styles.row}>
          {icon ? <Feather name={icon} size={20} color={contentColor} /> : null}
          {iconOnly ? null : (
            <AppText variant="button" color={contentColor} numberOfLines={1}>
              {label}
            </AppText>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.button,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  primary: { backgroundColor: colors.brand.navy },
  primaryPressed: { backgroundColor: colors.brand.navyDark },
  outline: {
    backgroundColor: colors.surface.card,
    borderWidth: 1.5,
    borderColor: colors.brand.navy,
  },
  outlinePressed: { backgroundColor: colors.brand.navySelected },
  iconOnly: { width: size.button, paddingHorizontal: 0 },
  disabled: { opacity: 0.4 },
});
