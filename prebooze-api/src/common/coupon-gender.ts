/** A coupon's gender-audience field ('all' | 'women' | 'men' | 'other',
 * set by the organizer/admin coupon editor's chip picker) uses different
 * words than a guest's own profile gender ('Female' | 'Male' | 'Non-binary'
 * | 'Prefer not to say', set at checkout) — a naive equality check between
 * the two never matches, so every gender-targeted coupon on the platform
 * silently rejected every guest regardless of their actual gender (real
 * bug: "GIRL500", coupon.gender: 'women', rejected an actual female buyer
 * whose profile gender was 'Female'). Normalizes both vocabularies onto the
 * same three buckets so the comparison actually means something. */
export function normalizeGender(g?: string | null): string {
  const s = (g ?? '').toLowerCase().trim();
  if (s === 'women' || s === 'female') return 'female';
  if (s === 'men' || s === 'male') return 'male';
  if (s === 'all') return 'all';
  return 'other';
}
