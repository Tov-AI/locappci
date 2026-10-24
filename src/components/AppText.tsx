import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, type, type TypeVariant } from '@/theme';

type Props = TextProps & {
  /** Type style from the design tokens. Defaults to body text. */
  variant?: TypeVariant;
  /** Text colour. Defaults to text.primary. */
  color?: string;
};

/** The only text component screens should use, so every label follows the type scale. */
export function AppText({ variant = 'body', color = colors.text.primary, style, ...rest }: Props) {
  return <Text style={[styles.base, type[variant], { color }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    // Keep text readable when the user enlarges the system font, without breaking layouts.
    flexShrink: 1,
  },
});
