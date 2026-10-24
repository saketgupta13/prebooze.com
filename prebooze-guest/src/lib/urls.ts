/** Ports the slug/path builders a guest actually needs from
 * prebooze-web/src/lib/urls.ts — just enough to build a real, shareable
 * https://prebooze.com/... link for an event (ShareButton's web
 * equivalent). Matches the backend's identical toCitySlug
 * (prebooze-api/src/common/city-slug.ts) exactly — kept as a duplicated
 * pure function rather than a shared package, same reasoning as web's own
 * comment on it. */
export const SITE_ORIGIN = 'https://prebooze.com';

export const toCitySlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const eventPath = (city: string, slug: string): string => `/${toCitySlug(city)}/events/${slug}`;

export const absoluteUrl = (path: string): string => `${SITE_ORIGIN}${path}`;

export const eventCity = (event: { venue?: { city: string } | null; privateCity?: string | null; unlistedVenueCity?: string | null }): string | undefined =>
  event.venue?.city ?? event.privateCity ?? event.unlistedVenueCity ?? undefined;
