import { useSyncExternalStore } from 'react';

import type { IsoDate, RentalRequestItem } from '@/api';
import { storage, storageKeys } from '@/data/storage';
import { today } from '@/utils/dates';

/**
 * "Ma demande de location": the rental items the person wants, saved on the phone
 * (like the website keeps it in the browser). Nothing is booked or paid: the list is sent
 * to the loueurs, or to LOCAPPCI on WhatsApp, and they answer.
 */

export type RequestLine = RentalRequestItem & {
  name: string;
  coverUrl: string | null;
  shopId: string;
  shopName: string;
  /** Price per day shown when added; 0 = "Prix à confirmer". Only a guide: the loueur confirms. */
  pricePerDay: number;
  minDays: number;
  maxDays: number;
};

/** The last send, so the confirmation can be shown again and a retry never sends twice. */
export type SentRequest = { reference: string; sentAt: string; count: number; channel: 'loueur' | 'whatsapp' };

type State = { lines: RequestLine[]; lastSent: SentRequest | null };

const MAX_LINES = 20;

let state: State = { lines: [], lastSent: null };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const save = () =>
  storage.setItem(storageKeys.rentalRequest, JSON.stringify(state)).catch(() => {
    // Not saved: the list still works until the app closes; the next change retries.
  });

const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  emit();
  save();
};

/** Read the saved list once at app start. */
export async function loadRentalRequest() {
  if (loaded) return;
  try {
    const raw = await storage.getItem(storageKeys.rentalRequest);
    const saved = raw ? (JSON.parse(raw) as State) : null;
    if (saved) {
      // Keep anything added before loading finished (very early tap).
      const early = state.lines.filter((l) => !saved.lines.some((s) => s.productId === l.productId));
      state = { lines: [...saved.lines, ...early].slice(0, MAX_LINES), lastSent: saved.lastSent ?? null };
    }
  } catch {
    // Unreadable storage: keep what is in memory rather than crash.
  }
  loaded = true;
  emit();
}

/** Add an item, or update it if it is already in the list (one line per item). */
export function putRequestLine(line: RequestLine): 'added' | 'updated' | 'full' {
  const exists = state.lines.some((l) => l.productId === line.productId);
  if (!exists && state.lines.length >= MAX_LINES) return 'full';
  set({
    lines: exists ? state.lines.map((l) => (l.productId === line.productId ? line : l)) : [...state.lines, line],
  });
  return exists ? 'updated' : 'added';
}

export function updateRequestLine(productId: string, change: Partial<Pick<RequestLine, 'startDate' | 'days' | 'quantity' | 'cityId'>>) {
  set({ lines: state.lines.map((l) => (l.productId === productId ? { ...l, ...change } : l)) });
}

export function removeRequestLine(productId: string): { line: RequestLine; index: number } | undefined {
  const index = state.lines.findIndex((l) => l.productId === productId);
  if (index < 0) return undefined;
  const line = state.lines[index];
  set({ lines: state.lines.filter((l) => l.productId !== productId) });
  return { line, index };
}

export function restoreRequestLine({ line, index }: { line: RequestLine; index: number }) {
  if (state.lines.some((l) => l.productId === line.productId)) return;
  const next = [...state.lines];
  next.splice(Math.min(index, next.length), 0, line);
  set({ lines: next });
}

/** After a successful send: the list is emptied and the receipt kept. */
export function markRequestSent(sent: SentRequest) {
  set({ lines: [], lastSent: sent });
}

/** Lines whose start date has passed (the list was left for a few days). */
export const isPastStart = (l: Pick<RequestLine, 'startDate'>, now: IsoDate = today()) => l.startDate < now;

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useRequestLines = () => useSyncExternalStore(subscribe, () => state.lines);
export const useRequestCount = () => useSyncExternalStore(subscribe, () => state.lines.length);
export const useRequestLine = (productId: string) =>
  useSyncExternalStore(subscribe, () => state.lines.find((l) => l.productId === productId));
export const useLastSentRequest = () => useSyncExternalStore(subscribe, () => state.lastSent);
export const getRequestLines = () => state.lines;
