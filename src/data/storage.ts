import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The phone's key-value storage, behind one small adapter.
 * Today: AsyncStorage, because it runs in Expo Go.
 * Later: swap this file to MMKV (faster) once we use a development build.
 * Nothing else in the app imports AsyncStorage directly.
 */
export const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const storageKeys = {
  queryCache: 'locappci.queryCache.v1',
  favourites: 'locappci.favourites.v1',
  city: 'locappci.city.v1',
  recentSearches: 'locappci.recentSearches.v1',
  cart: 'locappci.cart.v1',
  customer: 'locappci.customer.v1',
} as const;
