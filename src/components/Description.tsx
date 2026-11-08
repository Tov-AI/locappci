import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, space } from '@/theme';

/** Descriptions longer than this start folded, with "Lire la suite". */
const FOLD_AFTER_CHARS = 220;
const FOLDED_LINES = 5;

/** "Description" title and text, folded after 5 lines when long. */
export function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const foldable = text.length > FOLD_AFTER_CHARS;

  return (
    <View style={styles.section}>
      <AppText variant="cardTitle" accessibilityRole="header">
        Description
      </AppText>
      <AppText variant="body" color={colors.text.body} numberOfLines={foldable && !expanded ? FOLDED_LINES : undefined}>
        {text}
      </AppText>
      {foldable ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setExpanded((e) => !e)} style={styles.link}>
          <AppText variant="secondaryStrong" color={colors.brand.navy}>
            {expanded ? 'Réduire' : 'Lire la suite'}
          </AppText>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.brand.navy} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 32 },
});
