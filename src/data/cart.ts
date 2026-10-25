import { useSyncExternalStore } from 'react';

import type { CartCheckLine, CartCheckResult, Fcfa, IsoDate } from '@/api';
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

/** Change the quantity of a sale line (1 … maxQuantity). */
export function setQuantity(productId: string, quantity: number) {
  items = items.map((i) => {
    if (i.productId !== productId || i.rental) return i;
    const max = i.maxQuantity ?? Infinity;
    return { ...i, quantity: Math.max(1, Math.min(quantity, max)) };
  });
  emit();
  save();
}

/** Remove a line; returns it with its position so "Annuler" can put it back. */
export function removeLine(productId: string): { line: CartItem; index: number } | undefined {
  const index = items.findIndex((i) => i.productId === productId);
  if (index < 0) return undefined;
  const line = items[index];
  items = items.filter((i) => i.productId !== productId);
  emit();
  save();
  return { line, index };
}

/** Undo a removal, at the same place in the list. */
export function restoreLine({ line, index }: { line: CartItem; index: number }) {
  if (items.some((i) => i.productId === line.productId)) return;
  const next = [...items];
  next.splice(Math.min(index, next.length), 0, line);
  items = next;
  emit();
  save();
}

/** What we send to the gateway to check the whole cart before payment. */
export function toCheckLines(lines: CartItem[]): CartCheckLine[] {
  return lines.map((i) =>
    i.rental
      ? {
          productId: i.productId,
          rental: { startDate: i.rental.startDate, days: i.rental.days, shownPricePerDay: i.rental.pricePerDay },
        }
      : { productId: i.productId, quantity: i.quantity, shownPrice: i.price },
  );
}

/**
 * Apply the live answer: new prices and deposits, new stock limits,
 * quantity lowered when the shop has fewer units. Problems are not stored here:
 * the cart screen shows them until the next check.
 */
export function applyCartCheck(results: CartCheckResult[]) {
  const byId = new Map(results.map((r) => [r.productId, r]));
  items = items.map((i) => {
    const r = byId.get(i.productId);
    if (!r || r.problem === 'gone') return i;
    if (i.rental) {
      const rental = { ...i.rental, pricePerDay: r.price, deposit: r.deposit ?? i.rental.deposit };
      return { ...i, rental, price: rental.pricePerDay * rental.days };
    }
    const maxQuantity = r.maxQuantity === undefined ? i.maxQuantity : r.maxQuantity;
    const quantity =
      r.problem === 'not_enough_stock' && maxQuantity != null && maxQuantity > 0
        ? Math.min(i.quantity, maxQuantity)
        : i.quantity;
    return { ...i, price: r.price, maxQuantity, quantity };
  });
  emit();
  save();
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

/** Current lines, outside React (e.g. right after a check). */
export const getCartItems = () => items;

/** Changes when the person edits the line (quantity, dates): an old warning then no longer applies. */
export const lineSignature = (i: CartItem) =>
  i.rental ? `${i.rental.startDate}|${i.rental.days}` : String(i.quantity);

export type CartTotals = {
  /** Units of sale products. */
  saleUnits: number;
  saleTotal: number;
  rentalCount: number;
  rentalTotal: number;
  /** Refundable deposits, not included in total. */
  depositTotal: number;
  /** Paid now, before delivery fees. */
  total: number;
};

export function cartTotals(lines: CartItem[]): CartTotals {
  const t = { saleUnits: 0, saleTotal: 0, rentalCount: 0, rentalTotal: 0, depositTotal: 0, total: 0 };
  for (const i of lines) {
    if (i.rental) {
      t.rentalCount += 1;
      t.rentalTotal += i.price;
      t.depositTotal += i.rental.deposit;
    } else {
      t.saleUnits += i.quantity;
      t.saleTotal += i.price * i.quantity;
    }
  }
  t.total = t.saleTotal + t.rentalTotal;
  return t;
}
