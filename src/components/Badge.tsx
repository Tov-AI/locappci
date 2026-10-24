import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, fontFamily, radius } from '@/theme';

type CountProps = { count: number; style?: ViewStyle };

/** Orange count pill (cart items, new seller orders). Hidden at 0, shows "9+" above 9. */
export function CountBadge({ count, style }: CountProps) {
  if (count <= 0) return null;
  const label = count > 9 ? '9+' : String(count);
  return (
    <View
      style={[styles.count, style]}
      accessibilityLabel={`${count} nouveau${count > 1 ? 'x' : ''}`}>
      <AppText style={styles.countText} color={colors.text.primary}>
        {label}
      </AppText>
    </View>
  );
}

type DotProps = { visible?: boolean; style?: ViewStyle };

/** 9 pt orange dot with a white ring: "something new to see". */
export function DotBadge({ visible = true, style }: DotProps) {
  if (!visible) return null;
  return <View style={[styles.dot, style]} accessibilityElementsHidden importantForAccessibility="no" />;
}

type Tone = 'orange' | 'green' | 'navy' | 'neutral';

type TagProps = { label: string; tone?: Tone; style?: ViewStyle };

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  orange: { bg: colors.brand.orangeTint, fg: colors.brand.orangeText },
  green: { bg: colors.brand.greenTint, fg: colors.brand.greenText },
  navy: { bg: colors.brand.navyTint, fg: colors.brand.navyDark },
  neutral: { bg: colors.surface.neutral, fg: colors.text.muted },
};

/** Small status tag: "Location", "1 en cours", "Nouveau". */
export function Tag({ label, tone = 'orange', style }: TagProps) {
  const t = toneStyles[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }, style]}>
      <AppText variant="caption" color={t.fg} style={styles.tagText}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 14 },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.brand.orange,
    borderWidth: 2,
    borderColor: colors.surface.card,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagText: { fontFamily: fontFamily.bold },
});
