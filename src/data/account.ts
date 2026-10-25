import { useSyncExternalStore } from 'react';

import type { Account } from '@/api';
import { storage, storageKeys } from '@/data/storage';

/**
 * The account made after an order ("Gardez le suivi"). Only the name and phone are kept here.
 * The password goes to the gateway over HTTPS and is never stored on the phone.
 * Feature 14 (login with WordPress accounts) adds the real session token.
 */

let account: Account | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadAccount() {
  try {
    const raw = await storage.getItem(storageKeys.account);
    account = raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    account = null;
  }
  emit();
}

export function saveAccount(a: Account | null) {
  account = a;
  emit();
  (a ? storage.setItem(storageKeys.account, JSON.stringify(a)) : storage.removeItem(storageKeys.account)).catch(
    () => {
      // Not saved: the account still exists on the server; it shows again after login (Feature 14).
    },
  );
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useAccount = () => useSyncExternalStore(subscribe, () => account);
