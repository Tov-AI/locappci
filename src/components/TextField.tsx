import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, fontFamily, radius, size, space } from '@/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Error message shown under the field; also turns the border red. */
  error?: string;
  /** Small button inside the field on the right, e.g. show/hide password. */
  trailing?: ReactNode;
};

/** Labelled text field: label 12/600 above, 44 high, navy border on focus, red on error. */
export function TextField({ label, error, trailing, onFocus, onBlur, ...input }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" color={colors.text.body} style={styles.label}>
        {label}
      </AppText>
      <View>
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
          trailing ? styles.withTrailing : null,
        ]}
        {...input}
      />
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
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
  withTrailing: { paddingRight: size.touch + space.xs },
  trailing: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
});
