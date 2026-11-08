import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, space } from '@/theme';

type Icon = ComponentProps<typeof Feather>['name'];

type Props = {
  icon: Icon;
  iconColor?: string;
  title: string;
  text: string;
  /** Text links under the message, e.g. "Conditions de location", "Signaler cette annonce". */
  links?: { icon?: Icon; label: string; onPress: () => void }[];
};

/** Grey advice block: "Achetez en sécurité", "Avant de louer". */
export function InfoBlock({ icon, iconColor = colors.brand.navy, title, text, links = [] }: Props) {
  return (
    <View style={styles.block}>
      <Feather name={icon} size={20} color={iconColor} />
      <View style={styles.texts}>
        <AppText variant="secondaryStrong">{title}</AppText>
        <AppText variant="meta" color={colors.text.body}>
          {text}
        </AppText>
        {links.map((l) => (
          <Pressable key={l.label} accessibilityRole="button" hitSlop={8} onPress={l.onPress} style={styles.link}>
            {l.icon ? <Feather name={l.icon} size={16} color={colors.brand.navy} /> : null}
            <AppText variant="secondaryStrong" color={colors.brand.navy}>
              {l.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    gap: space.md,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.field,
  },
  texts: { flex: 1, gap: space.xs },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 36 },
});
