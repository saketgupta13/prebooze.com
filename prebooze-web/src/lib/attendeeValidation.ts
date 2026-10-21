/** Attendee name/WhatsApp validation — the name half mirrors prebooze-guest's
 * src/lib/attendeeValidation.ts (RN app) exactly. Checkout previously
 * accepted any string for both fields (numbers/symbols in names, unbounded/
 * unformatted phone numbers).
 *
 * The WhatsApp half deliberately does NOT mirror RN's "store bare 10
 * digits" approach — web stores `whatsapp` WITH the country code (e.g.
 * "+91 9876543210", same format Login.tsx produces), and that's the exact
 * string WhatsappService.send() later strips to digits-only and dials —
 * truncating to a bare 10-digit number here would silently break outbound
 * booking-confirmation WhatsApp messages. So this validates/sanitizes
 * around the existing with-country-code format instead of changing it. */

/** Strip anything that isn't a letter or a single space, live as the guest types. */
export const sanitizeName = (raw: string) => raw.replace(/[^A-Za-z ]/g, '').replace(/ {2,}/g, ' ');

/** Letters + single spaces only, no leading/trailing/double spaces. */
export const isValidName = (name: string) => /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name.trim());

/** Keep only digits/+/space as the guest types — same character set the
 * extra-guest WhatsApp field already sanitized to, now applied to the main
 * attendee's field too (which previously had no sanitization at all). */
export const sanitizePhoneChars = (raw: string) => raw.replace(/[^\d+ ]/g, '').slice(0, 14);

/** A real-looking phone number: 10 bare digits, or 10 digits plus a 1-3
 * digit country code (e.g. "9876543210", "+91 9876543210", "919876543210"). */
export const isValidWhatsapp = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
};
