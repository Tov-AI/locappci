import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, space } from '@/theme';

type Props = {
  /** Time the cached data was saved, e.g. "14 h 32". */
  savedAt?: string;
};

/** Dark banner shown under the header when there is no connection. */
export function OfflineBanner({ savedAt }: Props) {
  // Non-breaking spaces keep a time like "14 h 32" on one line.
  const when = savedAt ? `\u00A0à\u00A0${savedAt.replace(/ /g, '\u00A0')}` : '';
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Feather name="wifi-off" size={18} color={colors.text.inverse} />
      <AppText variant="meta" color={colors.text.inverse} style={styles.text}>
        {`Hors connexion. Annonces enregistrées${when} ; les prix sont revérifiés au paiement.`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.gutter,
    backgroundColor: colors.text.primary,
  },
  text: { flex: 1 },
});
