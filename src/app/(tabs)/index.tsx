import Feather from '@expo/vector-icons/Feather';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, space } from '@/theme';

export default function AccueilScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <AppText variant="display" color={colors.brand.navy} accessibilityRole="header">
            LOCAPPCI
          </AppText>
        </View>
        <View style={styles.city}>
          <Feather name="map-pin" size={14} color={colors.brand.navy} />
          <AppText variant="metaStrong" color={colors.text.muted}>
            Cocody, Abidjan
          </AppText>
        </View>
      </View>

      <EmptyState
        icon="shopping-bag"
        title="Les annonces arrivent bientôt"
        message="Vente et Location seront affichées ici dans la prochaine étape."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.lg, gap: space.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logo: { width: 26, height: 36 },
  city: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
