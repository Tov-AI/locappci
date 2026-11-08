import { useSyncExternalStore } from 'react';

import { storage, storageKeys } from '@/data/storage';

const MAX = 6;

let list: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const save = () =>
  storage.setItem(storageKeys.recentSearches, JSON.stringify(list)).catch(() => {
    // Not saved: the list still works until the app closes.
  });

/** Read saved searches once at app start. */
export async function loadRecentSearches() {
  if (loaded) return;
  try {
    const raw = await storage.getItem(storageKeys.recentSearches);
    list = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    list = [];
  }
  loaded = true;
  emit();
}

/** Most recent first, no duplicates (case-insensitive), at most 6. */
export function addRecentSearch(term: string) {
  const clean = term.trim();
  if (clean.length < 2) return;
  list = [clean, ...list.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, MAX);
  emit();
  save();
}

export function clearRecentSearches() {
  list = [];
  emit();
  save();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useRecentSearches = () => useSyncExternalStore(subscribe, () => list);
