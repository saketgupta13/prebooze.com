/** Mirrors prebooze-api's common/age-gate.ts requiredAgeFor (and
 * prebooze-web's identical copy) — Event.ageLimit is a controlled set from
 * the organizer's own wizard, never free text. */
export function requiredAgeFor(ageLimit: string): number | null {
  if (ageLimit === '18+') return 18;
  if (ageLimit === '21+') return 21;
  return null;
}

/** Same computation as prebooze-web's lib/ageGate.ts ageFromDob — used to
 * show a live "Age N" hint next to the DOB field while editing. */
export function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}
