import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, fontFamily, radius, size, space } from '@/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Error message shown under the field; also turns the border red. */
  error?: string;
};

/** Labelled text field: label 12/600 above, 44 high, navy border on focus, red on error. */
export function TextField({ label, error, onFocus, onBlur, ...input }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" color={colors.text.body} style={styles.label}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={colors.text.placeholder}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.focused,
          error ? styles.errored : null,
        ]}
        {...input}
      />
      {error ? (
        <AppText variant="meta" color={colors.status.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { fontFamily: fontFamily.semibold },
  input: {
    minHeight: size.field,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.input,
    backgroundColor: colors.surface.card,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.text.primary,
  },
  focused: { borderWidth: 2, borderColor: colors.brand.navy },
  errored: { borderWidth: 2, borderColor: colors.status.danger },
});
