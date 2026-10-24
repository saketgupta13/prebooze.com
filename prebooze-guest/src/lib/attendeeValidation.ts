/** Checkout attendee-form field rules — name and WhatsApp number both need
 * real validation (previously any non-empty string passed), not just
 * proactive sanitization while typing. Shared so Checkout applies the same
 * rule to the main attendee and every extra guest slot. */

// Letters and spaces only — no digits, no symbols. Strips disallowed
// characters live as the guest types, rather than letting them in and
// only complaining on submit.
export function sanitizeName(raw: string): string {
  return raw.replace(/[^A-Za-z ]/g, '');
}

export function isValidName(name: string): boolean {
  return /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name.trim());
}

// Digits only, capped at 10 — handles a pasted "+91 98765 43210" by
// stripping everything but digits and keeping the last 10 (the real
// subscriber number, not the country code).
export function sanitizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.slice(-10);
}

export function isValidWhatsapp(phone: string): boolean {
  return /^\d{10}$/.test(phone.trim());
}
