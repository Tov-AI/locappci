import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors, fontFamily, size } from '@/theme';

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
export default function TabsLayout() {
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
        options={{ title: 'Panier', tabBarIcon: icon('shopping-cart'), tabBarAccessibilityLabel: 'Panier' }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: 'Compte', tabBarIcon: icon('user'), tabBarAccessibilityLabel: 'Compte' }}
      />
    </Tabs>
  );
}
