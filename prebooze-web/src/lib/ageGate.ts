/** Mirrors prebooze-api's common/age-gate.ts requiredAgeFor — Event.ageLimit
 * is a controlled set from CreateEvent.tsx/CreateHostedEvent.tsx's own
 * <select>, never free text. */
export function requiredAgeFor(ageLimit: string): number | null {
  if (ageLimit === '18+') return 18;
  if (ageLimit === '21+') return 21;
  return null;
}

/** Mirrors prebooze-api's common/age-gate.ts ageFromDob exactly — same
 * calendar-aware subtraction, not just currentYear - birthYear (which
 * overcounts by one until the birthday actually passes this year). Used
 * for a live preview in EditProfile/FinishProfile the instant a guest
 * picks a date, before the real, authoritative value comes back from
 * AuthService.updateMe on save. */
export function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
