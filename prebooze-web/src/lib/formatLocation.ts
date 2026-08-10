/** "Hyderabad, Telangana" / "Hyderabad, Telangana, India" / just "Hyderabad"
 * when state/country aren't set — used on every public profile's "Based in"
 * line (organizer/promoter/venue/lineup). Country is only appended when it's
 * meaningfully set and isn't the default "India" everyone's already in. */
export function formatLocation(loc: { city: string; state?: string | null; country?: string | null }): string {
  const parts = [loc.city, loc.state || undefined, loc.country && loc.country !== 'India' ? loc.country : undefined];
  return parts.filter(Boolean).join(', ');
}
