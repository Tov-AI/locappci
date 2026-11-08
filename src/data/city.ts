import { useSyncExternalStore } from 'react';

import { storage, storageKeys } from '@/data/storage';

/**
 * The user's commune, saved on the phone. It sorts every list ("Plus proches").
 *
 * - undefined → not read from storage yet (don't show the first-launch question yet)
 * - null      → never answered: show "Où êtes-vous ?" once
 * - ''        → answered "Passer" or chose all of Côte d'Ivoire
 * - 'cocody'  → a commune id from the API
 */
export type CityChoice = string | null | undefined;

let value: CityChoice = undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadCity() {
  if (value !== undefined) return;
  try {
    const raw = await storage.getItem(storageKeys.city);
    value = raw === null ? null : raw;
  } catch {
    value = null;
  }
  emit();
}

export function setCity(cityId: string) {
  value = cityId;
  emit();
  storage.setItem(storageKeys.city, cityId).catch(() => {
    // Not saved: the choice still applies until the app closes.
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useCity = () => useSyncExternalStore(subscribe, () => value);
