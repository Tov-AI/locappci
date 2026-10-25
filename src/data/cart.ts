import { useSyncExternalStore } from 'react';

import type { Fcfa, IsoDate } from '@/api';
import { storage, storageKeys } from '@/data/storage';

/**
 * The cart, saved on the phone so it survives closing the app and works offline.
 * Sale products: one line per product, quantity up to the shop's stock.
 * Rentals: one booking per item (dates + duration); booking it again replaces the dates.
 * Prices, stock and dates are checked again live before payment (Feature 9).
 */

export type CartItem = {
  productId: string;
  name: string;
  /** Unit price confirmed by the last live check. For a rental: the total for the whole period. */
  price: Fcfa;
  coverUrl: string | null;
  shopId: string;
  shopName: string;
  quantity: number;
  /** Units the shop has, if it says; the cart never goes above it. */
  maxQuantity: number | null;
  /** Present only for rentals. */
  rental?: RentalBooking;
};

export type RentalBooking = {
  startDate: IsoDate;
  days: number;
  pricePerDay: Fcfa;
  /** Refundable deposit, paid on top. */
  deposit: Fcfa;
};

/** What happened, and how many units of this product the cart now holds. */
export type AddResult = { outcome: 'added' | 'increased' | 'at_max'; quantity: number };

let items: CartItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const save = () =>
  storage.setItem(storageKeys.cart, JSON.stringify(items)).catch(() => {
    // Not saved: the cart still works until the app closes; the next change retries.
  });

/** Read the saved cart once at app start. */
export async function loadCart() {
  if (loaded) return;
  try {
    const raw = await storage.getItem(storageKeys.cart);
    const saved = raw ? (JSON.parse(raw) as CartItem[]) : [];
    // Keep anything added before loading finished (very early tap).
    const early = items.filter((i) => !saved.some((s) => s.productId === i.productId));
    items = [...saved, ...early];
  } catch {
    // Unreadable storage: keep what is in memory rather than crash.
  }
  loaded = true;
  emit();
}

/**
 * Add one unit. If the product is already in the cart, add one more (never above maxQuantity).
 * The price and stock limit are refreshed with the latest live check.
 */
export function addToCart(item: Omit<CartItem, 'quantity'>): AddResult {
  const existing = items.find((i) => i.productId === item.productId);
  if (!existing) {
    items = [...items, { ...item, quantity: 1 }];
    emit();
    save();
    return { outcome: 'added', quantity: 1 };
  }
  const max = item.maxQuantity ?? Infinity;
  const atMax = existing.quantity >= max;
  const quantity = atMax ? Math.max(1, Math.min(existing.quantity, max)) : existing.quantity + 1;
  // New array and new object each time so React sees the change.
  items = items.map((i) => (i.productId === item.productId ? { ...item, quantity } : i));
  emit();
  save();
  return { outcome: atMax ? 'at_max' : 'increased', quantity };
}

/**
 * Put a rental booking in the cart. An item can only be booked once:
 * booking it again with other dates replaces the previous booking.
 */
export function addRentalToCart(
  item: Omit<CartItem, 'quantity' | 'maxQuantity' | 'price' | 'rental'> & { rental: RentalBooking },
): 'added' | 'updated' {
  const line: CartItem = {
    ...item,
    price: item.rental.pricePerDay * item.rental.days,
    quantity: 1,
    maxQuantity: 1,
  };
  const exists = items.some((i) => i.productId === item.productId);
  items = exists ? items.map((i) => (i.productId === item.productId ? line : i)) : [...items, line];
  emit();
  save();
  return exists ? 'updated' : 'added';
}

export function clearCart() {
  items = [];
  emit();
  save();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useCartItems = () => useSyncExternalStore(subscribe, () => items);

/** Total number of units, for the Panier tab badge. */
export const useCartCount = () =>
  useSyncExternalStore(subscribe, () => items.reduce((n, i) => n + i.quantity, 0));

/** How many units of one product are already in the cart. */
export const useCartQuantity = (productId: string) =>
  useSyncExternalStore(subscribe, () => items.find((i) => i.productId === productId)?.quantity ?? 0);

/** The cart line of one product, if any (e.g. the current rental booking). */
export const useCartLine = (productId: string) =>
  useSyncExternalStore(subscribe, () => items.find((i) => i.productId === productId));
