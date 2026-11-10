import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { api, type Account, type Session } from '@/api';
import { onSessionExpired, setSessionToken } from '@/api/token';
import { storage, storageKeys } from '@/data/storage';

/**
 * The signed-in customer on this phone.
 * - The account (name, phone, e-mail) is kept in ordinary storage, to show the profile at once.
 * - The session token is kept in the phone's secure storage (Android Keystore / iOS Keychain).
 * - The password goes to the gateway over HTTPS and is never stored on the phone.
 */

let account: Account | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Secure storage does not exist in a web browser (development preview only): ordinary storage there. */
const secure = Platform.OS !== 'web';
const tokenStore = {
  get: () => (secure ? SecureStore.getItemAsync(storageKeys.sessionToken) : storage.getItem(storageKeys.sessionToken)),
  set: (value: string) =>
    secure ? SecureStore.setItemAsync(storageKeys.sessionToken, value) : storage.setItem(storageKeys.sessionToken, value),
  remove: () =>
    secure ? SecureStore.deleteItemAsync(storageKeys.sessionToken) : storage.removeItem(storageKeys.sessionToken),
};

export async function loadAccount() {
  try {
    const [raw, token] = await Promise.all([storage.getItem(storageKeys.account), tokenStore.get()]);
    const saved = raw ? (JSON.parse(raw) as Partial<Account>) : null;
    // An account saved by an older version has no session: it must sign in again.
    if (saved?.name && token) {
      account = { name: saved.name, phone: saved.phone ?? '', email: saved.email ?? null };
      setSessionToken(token);
    } else {
      account = null;
      setSessionToken(null);
    }
  } catch {
    account = null;
    setSessionToken(null);
  }
  emit();
}

/** After login or account creation. */
export function saveSession(session: Session) {
  account = session.account;
  setSessionToken(session.token);
  emit();
  Promise.all([storage.setItem(storageKeys.account, JSON.stringify(session.account)), tokenStore.set(session.token)]).catch(
    () => {
      // Not saved: still signed in until the app closes; next time they sign in again.
    },
  );
}

/** Forget the account on this phone. `tellServer`: also end the session on the server ("Se déconnecter"). */
export function clearSession(tellServer = false) {
  if (tellServer) {
    // Best effort: offline or already expired, the phone signs out anyway.
    api.logout().catch(() => undefined);
  }
  account = null;
  // After the logout request has read the token (it reads it synchronously when it starts).
  setSessionToken(null);
  emit();
  Promise.all([storage.removeItem(storageKeys.account), tokenStore.remove()]).catch(() => undefined);
}

// The gateway said the session is over (expired, password changed): show "Se connecter" again.
onSessionExpired(() => clearSession());

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useAccount = () => useSyncExternalStore(subscribe, () => account);
