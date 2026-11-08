import { useSyncExternalStore } from 'react';

import type { Order } from '@/api';
import { storage, storageKeys } from '@/data/storage';

/**
 * Orders placed from this phone, newest first (at most 50), so "Mes commandes" works
 * offline and without an account. With login (Feature 14) the gateway's list replaces it.
 */

const MAX = 50;

let orders: Order[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const save = () =>
  storage.setItem(storageKeys.orders, JSON.stringify(orders)).catch(() => {
    // Not saved: the list still works until the app closes.
  });

export async function loadOrders() {
  try {
    const raw = await storage.getItem(storageKeys.orders);
    orders = raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    orders = [];
  }
  emit();
}

/** Add or update (same id) an order, newest first. */
export function rememberOrder(order: Order) {
  orders = [order, ...orders.filter((o) => o.id !== order.id)].slice(0, MAX);
  emit();
  save();
}

export function forgetOrders() {
  orders = [];
  emit();
  save();
}

export const getRememberedOrder = (id: string) => orders.find((o) => o.id === id);

/** Paid, confirmed or transfer being checked, not delivered yet. */
export const isInProgress = (o: Order) =>
  (o.status === 'paid' || o.status === 'confirmed' || o.status === 'awaiting_confirmation') && o.step !== 'delivered';

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useMyOrders = () => useSyncExternalStore(subscribe, () => orders);
