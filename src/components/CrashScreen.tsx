import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, space } from '@/theme';

type Props = { error: Error; retry: () => Promise<void> };

/**
 * Last safety net: if a screen crashes, show this instead of a white screen or a closed app.
 * The cart, favourites and saved details are on the phone, so nothing is lost.
 */
export function CrashScreen({ error, retry }: Props) {
  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.box}>
        <AppText variant="display" accessibilityRole="header" style={styles.center}>
          Oups, un problème est survenu
        </AppText>
        <AppText variant="body" color={colors.text.body} style={styles.center}>
          Votre panier et vos favoris sont bien gardés. Réessayez ; si le problème continue, fermez puis rouvrez l’appli.
        </AppText>
        <Button label="Réessayer" icon="refresh-cw" onPress={() => retry()} />
        {__DEV__ ? (
          // Developers only: the real error, to fix it.
          <AppText variant="caption" color={colors.status.danger} selectable>
            {error.message}
          </AppText>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  box: { flex: 1, justifyContent: 'center', padding: space.xxl, gap: space.lg },
  center: { textAlign: 'center' },
});
