/** The backend stores/expects dob as ISO (YYYY-MM-DD, same as an HTML
 * `<input type="date">` on web) — but DD-MM-YYYY is the format guests here
 * expect to type and read. These convert at the UI boundary only; nothing
 * past the screen layer ever sees DD-MM-YYYY. */

/** YYYY-MM-DD → DD-MM-YYYY, for showing a stored value in the field. */
export function isoToDisplayDob(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** DD-MM-YYYY → YYYY-MM-DD, for sending a typed value to the backend.
 * Returns '' if the input isn't a complete, valid-looking date yet. */
export function displayDobToIso(display: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(display.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Auto-inserts dashes as the guest types digits, same UX as the card
 * expiry (MM/YY) field already uses elsewhere — caps at DD-MM-YYYY length. */
export function autoFormatDobInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}
