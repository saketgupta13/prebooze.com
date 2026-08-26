/** Mirrors prebooze-api's common/age-gate.ts requiredAgeFor — Event.ageLimit
 * is a controlled set from CreateEvent.tsx/CreateHostedEvent.tsx's own
 * <select>, never free text. */
export function requiredAgeFor(ageLimit: string): number | null {
  if (ageLimit === '18+') return 18;
  if (ageLimit === '21+') return 21;
  return null;
}
