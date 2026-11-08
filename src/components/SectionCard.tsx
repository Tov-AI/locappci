import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, fontFamily, radius, space } from '@/theme';

type Props = {
  title?: string;
  children: ReactNode;
  /** Highlighted card with a 2 pt navy border (e.g. the account offer). */
  highlighted?: boolean;
  style?: ViewStyle;
};

/** White card, 1 pt border, radius 14, padding 14, optional 15/700 title. */
export function SectionCard({ title, children, highlighted = false, style }: Props) {
  return (
    <View style={[styles.card, highlighted && styles.highlighted, style]}>
      {title ? (
        <AppText variant="bodyStrong" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: 14,
    gap: space.md,
  },
  highlighted: { borderWidth: 2, borderColor: colors.brand.navy },
  title: { fontFamily: fontFamily.bold },
});
