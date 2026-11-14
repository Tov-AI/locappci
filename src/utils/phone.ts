/**
 * Phone numbers, kept as digits with the country code and no "+": "2250700000000", "447700900123".
 *
 * - Ivorian numbers (most customers): 10 digits since 2021, starting 01, 05, 07 (mobile) or 21, 25, 27
 *   (fixed). People type them in many ways: "07 00 00 00 00", "+225 0700000000", "00225…".
 * - Numbers from other countries (customers abroad who buy or rent for family in Côte d'Ivoire):
 *   they must start with "+" or "00" and the country code, e.g. "+33 6 12 34 56 78".
 *   Without it we cannot tell which country a number belongs to.
 */
const CI_LOCAL = /^(01|05|07|21|25|27)\d{8}$/;

/** Message shown under a phone field when the number is not understood. */
export const PHONE_HELP = 'Numéro invalide. Ex. 07 00 00 00 00, ou +33 6 12 34 56 78 depuis l’étranger.';
export const PHONE_PLACEHOLDER = '07 00 00 00 00 ou +33 6 12 34 56 78';

/** Digits with country code, or null when the number is not valid. */
export function normalizePhone(input: string): string | null {
  const typed = input.trim();
  const international = /^(\+|00)/.test(typed);
  let digits = typed.replace(/\D/g, '');
  if (international && digits.startsWith('00')) digits = digits.slice(2);

  // Ivorian, however it was typed.
  const local = digits.startsWith('225') && digits.length === 13 ? digits.slice(3) : digits;
  if (CI_LOCAL.test(local) && (local !== digits || !international)) return `225${local}`;
  if (digits.startsWith('225')) return null; // +225 with a wrong number

  // Another country: only with "+" or "00", 8 to 15 digits (the international standard).
  return international && /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

const isCi = (normalized: string) => normalized.startsWith('225') && normalized.length === 13;

/** "2250700000000" → "07 00 00 00 00" (how people write it locally); "447700900123" → "+447700900123". */
export function formatPhone(normalized: string): string {
  if (!isCi(normalized)) return `+${normalized}`;
  return normalized.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ');
}

/** "+225 07 •• •• •• 12": enough to recognise the number, not enough to read it over a shoulder. */
export function maskPhone(normalized: string): string {
  if (!isCi(normalized)) return `+${normalized.slice(0, 2)} ••••••• ${normalized.slice(-2)}`;
  const local = normalized.slice(3);
  return `+225 ${local.slice(0, 2)} •• •• •• ${local.slice(-2)}`;
}
