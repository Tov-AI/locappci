import { useSyncExternalStore } from 'react';

import { storage, storageKeys } from '@/data/storage';

/**
 * "Être prévenu dès que votre commande est expédiée ?" — our own question, asked before the
 * phone's system prompt (a "soft ask"). People who say yes get the real Android/iOS
 * permission prompt once push notifications are switched on (Feature 16).
 * "Plus tard" hides the question for 7 days.
 */

type Answer = { answer: 'yes' | 'later'; at: number };

const LATER_MS = 7 * 24 * 60 * 60_000;

let saved: Answer | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadNotificationAnswer() {
  try {
    const raw = await storage.getItem(storageKeys.notifications);
    saved = raw ? (JSON.parse(raw) as Answer) : null;
  } catch {
    saved = null;
  }
  loaded = true;
  emit();
}

export function answerNotifications(answer: Answer['answer']) {
  saved = { answer, at: Date.now() };
  emit();
  storage.setItem(storageKeys.notifications, JSON.stringify(saved)).catch(() => {
    // Not saved: we may ask again next time, which is harmless.
  });
}

/** Whether to show the question now (only once the saved answer has been read). */
export function shouldAskNotifications(a: Answer | null, now = Date.now()) {
  if (!a) return true;
  return a.answer === 'later' && now - a.at > LATER_MS;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useNotificationAnswer = () =>
  useSyncExternalStore(subscribe, () => (loaded ? saved : undefined));
