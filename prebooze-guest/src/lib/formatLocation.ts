export function formatLocation(loc: { city: string; state?: string | null; country?: string | null }): string {
  const parts = [loc.city, loc.state || undefined, loc.country && loc.country !== 'India' ? loc.country : undefined];
  return parts.filter(Boolean).join(', ');
}
