import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

type Props = {
  children: ReactNode;
  /** Scroll the content (default) or keep it fixed. */
  scroll?: boolean;
  /** Background colour of the whole screen. */
  background?: string;
  /** Safe-area edges to pad. Tab screens pad the top only; the tab bar handles the bottom. */
  edges?: Edge[];
  contentStyle?: ViewStyle;
};

/** Standard screen wrapper: safe area, grey ground, 16 pt side margins. */
export function Screen({
  children,
  scroll = true,
  background = colors.surface.ground,
  edges = ['top'],
  contentStyle,
}: Props) {
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: space.gutter,
    paddingBottom: space.xxl,
    gap: space.xl,
  },
});
