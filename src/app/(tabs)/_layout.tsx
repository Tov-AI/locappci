import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCartCount } from '@/data/cart';
import { colors, fontFamily, size, space } from '@/theme';

type IconName = ComponentProps<typeof Feather>['name'];

const icon =
  (name: IconName) =>
  ({ color }: { color: ColorValue }) => (
    <Feather name={name} size={size.iconTab} color={color as string} />
  );

/**
 * Bottom tab bar from the handoff: 5 tabs, icon + French label,
 * navy when active, muted grey when not.
 */
/** Height of the icons + labels row, without the space for the phone's gesture bar. */
const TAB_ROW_HEIGHT = 58;

export default function TabsLayout() {
  const cartCount = useCartCount();
  const insets = useSafeAreaInsets();
  // Some Android phones (e.g. OPPO in full-screen gesture mode) report no bottom inset:
  // keep a minimum gap so labels never touch the rounded bottom corners.
  const bottomGap = Math.max(insets.bottom, space.md);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.navy,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface.card,
          borderTopColor: colors.border.default,
          height: TAB_ROW_HEIGHT + bottomGap,
          paddingTop: space.xs,
          paddingBottom: bottomGap,
          // Pull "Accueil" and "Compte" away from the rounded screen corners.
          paddingHorizontal: space.md,
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.brand.orange,
          color: colors.text.primary,
          fontFamily: fontFamily.bold,
          fontSize: 10,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Accueil', tabBarIcon: icon('home'), tabBarAccessibilityLabel: 'Accueil' }}
      />
      <Tabs.Screen
        name="recherche"
        options={{ title: 'Recherche', tabBarIcon: icon('search'), tabBarAccessibilityLabel: 'Recherche' }}
      />
      <Tabs.Screen
        name="favoris"
        options={{ title: 'Favoris', tabBarIcon: icon('heart'), tabBarAccessibilityLabel: 'Favoris' }}
      />
      <Tabs.Screen
        name="panier"
        options={{
          title: 'Panier',
          tabBarIcon: icon('shopping-cart'),
          // Orange count, "9+" above 9, hidden when empty.
          tabBarBadge: cartCount > 0 ? (cartCount > 9 ? '9+' : cartCount) : undefined,
          tabBarAccessibilityLabel: cartCount > 0 ? `Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}` : 'Panier',
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: 'Compte', tabBarIcon: icon('user'), tabBarAccessibilityLabel: 'Compte' }}
      />
    </Tabs>
  );
}
