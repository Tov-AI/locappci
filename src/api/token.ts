/**
 * The session token of the signed-in customer, in memory.
 * Kept in its own small file so the API clients can read it without importing the data layer.
 * It is saved on the phone by src/data/account.ts (secure storage), never in this file.
 */
let token: string | null = null;
let onExpired: (() => void) | null = null;

export const getSessionToken = () => token;

export function setSessionToken(value: string | null) {
  token = value;
}

/** Called when the gateway answers "unauthorized" to a request that carried the token. */
export function onSessionExpired(listener: () => void) {
  onExpired = listener;
}

export function sessionExpired() {
  if (token && onExpired) onExpired();
}
