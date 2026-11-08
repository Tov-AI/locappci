import { useSyncExternalStore } from 'react';

import type { Customer } from '@/api';
import { storage, storageKeys } from '@/data/storage';

/**
 * The person's contact details, kept on this phone after a checkout so the next one is faster.
 * No account needed (guest checkout). Feature 14 (login) can fill them from the account instead.
 */

let saved: Customer | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadCustomer() {
  try {
    const raw = await storage.getItem(storageKeys.customer);
    saved = raw ? (JSON.parse(raw) as Customer) : null;
  } catch {
    saved = null;
  }
  emit();
}

export function saveCustomer(c: Customer) {
  saved = c;
  emit();
  storage.setItem(storageKeys.customer, JSON.stringify(c)).catch(() => {
    // Not saved: they will type them again next time, nothing else breaks.
  });
}

export function clearCustomer() {
  saved = null;
  emit();
  storage.removeItem(storageKeys.customer).catch(() => {
    // Not removed: harmless, the fields can be cleared by hand.
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useSavedCustomer = () => useSyncExternalStore(subscribe, () => saved);
