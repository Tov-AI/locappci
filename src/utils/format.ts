/**
 * "18 500 FCFA": a normal space every three digits, as the handoff requires.
 * Built by hand rather than with toLocaleString, because the phone's locale data
 * varies between Android versions and can produce narrow or odd spaces.
 * The final space is non-breaking so "FCFA" never wraps onto its own line.
 */
export function formatFcfa(amount: number): string {
  const digits = Math.round(amount).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} FCFA`;
}

/** "14 h 32", with non-breaking spaces so it stays on one line. */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getHours()} h ${mm}`;
}
