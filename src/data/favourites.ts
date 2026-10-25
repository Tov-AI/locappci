import { useCallback, useSyncExternalStore } from 'react';

import { storage, storageKeys } from '@/data/storage';

/**
 * Favourites, saved on the phone so they work offline.
 * Optimistic: the heart changes at once; the list is written to storage straight after.
 * Feature 14 (login) will also send this list to the gateway so it follows the account.
 */

let ids = new Set<string>();
let loaded = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

/** Read the saved list once at app start. */
export async function loadFavourites() {
  if (loaded) return;
  try {
    const raw = await storage.getItem(storageKeys.favourites);
    ids = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    // Unreadable storage: start with an empty list rather than crash.
    ids = new Set();
  }
  loaded = true;
  emit();
}

function save() {
  storage.setItem(storageKeys.favourites, JSON.stringify([...ids])).catch(() => {
    // Saving failed (storage full?): keep the in-memory list; the next toggle retries.
  });
}

export function toggleFavourite(productId: string) {
  // New Set each time so React sees a change.
  const next = new Set(ids);
  if (next.has(productId)) next.delete(productId);
  else next.add(productId);
  ids = next;
  emit();
  save();
}

export function clearFavourites() {
  ids = new Set();
  emit();
  save();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** All favourite ids (re-renders when the list changes). */
export const useFavouriteIds = () => useSyncExternalStore(subscribe, () => ids);

/** One product: [isSaved, toggle]. */
export function useFavourite(productId: string) {
  const all = useFavouriteIds();
  const toggle = useCallback(() => toggleFavourite(productId), [productId]);
  return [all.has(productId), toggle] as const;
}
