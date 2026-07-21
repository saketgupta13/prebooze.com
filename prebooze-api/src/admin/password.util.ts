import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/** No bcrypt/argon2 dependency added for this — Node's built-in scrypt is a
 * solid KDF and keeps the dependency list lean, consistent with the rest of
 * this backend (e.g. guest OTPs are random digits + Redis TTL, no hashing
 * library either). Stored as "salt:hash", both hex. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, 'hex');
  const testBuf = scryptSync(password, salt, 64);
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf);
}

/** Random temp password for a freshly-invited staff member — there's no
 * invite-email infra (Resend) wired up yet, so this is returned once in the
 * create-staff response for the Owner to share out-of-band. See BACKEND.md. */
export function randomTempPassword(): string {
  return randomBytes(9).toString('base64url'); // 12 chars, URL-safe
}
