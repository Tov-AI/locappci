import { useSyncExternalStore } from 'react';

import type { ContactUnlock } from '@/api';
import { storage, storageKeys } from '@/data/storage';

/**
 * « Obtenir les coordonnées » asked from this phone (at most 50, newest first), so a seller's
 * contact stays visible after it was paid, even offline. One entry per shop: the newest wins.
 */

const MAX = 50;

let unlocks: ContactUnlock[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const save = () =>
  storage.setItem(storageKeys.contactUnlocks, JSON.stringify(unlocks)).catch(() => {
    // Not saved: still works until the app closes.
  });

export async function loadContactUnlocks() {
  try {
    const raw = await storage.getItem(storageKeys.contactUnlocks);
    unlocks = raw ? (JSON.parse(raw) as ContactUnlock[]) : [];
  } catch {
    unlocks = [];
  }
  emit();
}

/** Add or update an unlock; a paid one is never replaced by a newer unpaid one for the same shop. */
export function rememberContactUnlock(u: ContactUnlock) {
  const paid = unlocks.find((x) => x.shopId === u.shopId && x.status === 'paid' && x.id !== u.id);
  if (paid && u.status !== 'paid') return;
  unlocks = [u, ...unlocks.filter((x) => x.shopId !== u.shopId)].slice(0, MAX);
  emit();
  save();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** The latest unlock asked for this shop on this phone, if any. */
export const useContactUnlock = (shopId?: string) =>
  useSyncExternalStore(subscribe, () => (shopId ? unlocks.find((u) => u.shopId === shopId) : undefined));
