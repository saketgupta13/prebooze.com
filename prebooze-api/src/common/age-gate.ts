/** Event.ageLimit is a controlled set from CreateEvent.tsx/CreateHostedEvent.tsx's
 * own <select> — "All ages" | "18+" | "21+" — never free text. */
export function requiredAgeFor(ageLimit: string): number | null {
  if (ageLimit === '18+') return 18;
  if (ageLimit === '21+') return 21;
  return null;
}

/** Whole-years-as-of-today age from a "YYYY-MM-DD" dob string — same
 * calendar-aware subtraction every age calculator uses (not just
 * currentYear - birthYear, which overcounts by one until the birthday
 * actually passes this year). */
export function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
