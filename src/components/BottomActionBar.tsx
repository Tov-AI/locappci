import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, space } from '@/theme';

type Props = {
  /** Optional line above the buttons, e.g. "1 article · livraison incluse". */
  summary?: string;
  /** Optional value on the right of the summary, e.g. the total. */
  total?: string;
  /** The buttons. Wrap the main one with flex: 1 to fill the width. */
  children: ReactNode;
};

/** Fixed white bar at the bottom of detail and checkout screens, above the home indicator. */
export function BottomActionBar({ summary, total, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) + space.sm }]}>
      {summary || total ? (
        <View style={styles.summary}>
          <AppText variant="secondary" color={colors.text.body}>
            {summary}
          </AppText>
          {total ? <AppText variant="cardTitle">{total}</AppText> : null}
        </View>
      ) : null}
      <View style={styles.buttons}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: space.md,
    paddingHorizontal: space.gutter,
    gap: space.md,
  },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  buttons: { flexDirection: 'row', gap: space.md },
});
