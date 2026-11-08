import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Developer switch from the "Données (dev)" screen: pretend the phone has no network. */
let forcedOffline = false;
let lastRealState = true;

const apply = () => onlineManager.setOnline(lastRealState && !forcedOffline);

/**
 * Tell TanStack Query when the phone goes offline or comes back.
 * Offline: requests pause (no failed spinners), cached data stays on screen.
 * Back online: paused requests run again automatically.
 */
export function startOnlineTracking() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // isInternetReachable can be null while unknown: treat unknown as online.
      lastRealState = !!state.isConnected && state.isInternetReachable !== false;
      setOnline(lastRealState && !forcedOffline);
    }),
  );
}

export function setForcedOffline(value: boolean) {
  forcedOffline = value;
  apply();
}

export const isForcedOffline = () => forcedOffline;

/** true / false, updated live. Use it to show the offline banner. */
export function useOnline() {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
  );
}
