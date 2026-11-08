/**
 * Ivorian phone numbers: 10 digits since 2021, starting 01, 05, 07 (mobile) or 21, 25, 27 (fixed),
 * with country code 225. People type them in many ways: "07 00 00 00 00", "+225 0700000000", "00225…".
 */
const VALID = /^(01|05|07|21|25|27)\d{8}$/;

/** "2250700000000" (digits only, with 225), or null when it isn't a valid Ivorian number. */
export function normalizeCiPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00225')) digits = digits.slice(5);
  else if (digits.startsWith('225') && digits.length === 13) digits = digits.slice(3);
  return VALID.test(digits) ? `225${digits}` : null;
}

/** "2250700000000" → "07 00 00 00 00" (how people write it locally). */
export function formatCiPhone(normalized: string): string {
  const local = normalized.startsWith('225') ? normalized.slice(3) : normalized;
  return local.replace(/(\d{2})(?=\d)/g, '$1 ');
}

/** "+225 07 •• •• •• 12": enough to recognise the number, not enough to read it over a shoulder. */
export function maskPhone(normalized: string): string {
  const local = normalized.startsWith('225') ? normalized.slice(3) : normalized;
  return `+225 ${local.slice(0, 2)} •• •• •• ${local.slice(-2)}`;
}
