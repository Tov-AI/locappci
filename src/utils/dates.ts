/**
 * Calendar dates as "YYYY-MM-DD" strings, in the phone's local time.
 * Côte d'Ivoire is on GMT all year (no summer time), so local days and server days match.
 * We never use toLocaleDateString: phone locale data varies (same reason as formatFcfa).
 */
export type IsoDate = string;

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Noon local time: adding days never lands on the wrong date. */
export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export const today = (): IsoDate => toIsoDate(new Date());

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** The days a rental occupies: start, start + 1, … (days in total). */
export function rentalDays(start: IsoDate, days: number): IsoDate[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

/** "samedi 31/10" */
export function formatDayShort(iso: IsoDate): string {
  const d = fromIsoDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** "samedi 31 octobre", read aloud by screen readers. */
export function formatDayLong(iso: IsoDate): string {
  const d = fromIsoDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Octobre 2026" */
export function formatMonth(year: number, month: number): string {
  const name = MONTHS[month];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/** "1 jour", "3 jours" (non-breaking space: "1" never ends a line). */
export const formatDays = (n: number) => `${n}\u00A0jour${n > 1 ? 's' : ''}`;

const SHORT_DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** "sam. 31/10", for small spaces. */
export function formatDayCompact(iso: IsoDate): string {
  const d = fromIsoDate(iso);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
