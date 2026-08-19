/** Shared path/URL builders for the guest site's city-prefixed discovery
 * routes (/:city/browse, /:city/venues/:id, etc.) — before this, every Link
 * was an ad-hoc template literal built independently at each call site,
 * which would have meant hand-threading a city segment into 200+ places
 * with no single source of truth for the URL shape. */

export const SITE_ORIGIN = 'https://prebooze.com';

/** Matches the backend's identical `toCitySlug` (prebooze-api/src/common/
 * city-slug.ts) — kept as two small duplicated pure functions rather than a
 * shared package, since there's no existing shared-code mechanism between
 * the two repos and this is the only thing that would need one. Never used
 * to reverse a slug back into a real city name — always resolve an
 * incoming URL segment by comparing this against the real city list
 * instead (see useCityList/CityScope). */
export const toCitySlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const absoluteUrl = (path: string): string => `${SITE_ORIGIN}${path}`;

export const cityHome = (city: string): string => `/${toCitySlug(city)}`;
export const cityBrowse = (city: string): string => `/${toCitySlug(city)}/browse`;
export const cityCategories = (city: string): string => `/${toCitySlug(city)}/categories`;
export const cityVenues = (city: string): string => `/${toCitySlug(city)}/venues`;
export const cityOrganizers = (city: string): string => `/${toCitySlug(city)}/organizers`;
export const cityPromoters = (city: string): string => `/${toCitySlug(city)}/promoters`;
export const cityLineups = (city: string): string => `/${toCitySlug(city)}/lineups`;
export const cityPeople = (city: string): string => `/${toCitySlug(city)}/people`;

export const eventPath = (city: string, slug: string): string => `/${toCitySlug(city)}/events/${slug}`;
export const venuePath = (city: string, id: string): string => `/${toCitySlug(city)}/venues/${id}`;
export const organizerPath = (city: string, id: string): string => `/${toCitySlug(city)}/organizers/${id}`;
export const promoterPath = (city: string, slug: string): string => `/${toCitySlug(city)}/promoter/${slug}`;
export const lineupPath = (city: string, slug: string): string => `/${toCitySlug(city)}/lineup/${slug}`;

/** An event's own city is either its venue's, or — for a venue-less
 * "secret"/guest-list-only event — Event.privateCity. Exactly one of the
 * two is always set (schema invariant), never both, never neither. */
export const eventCity = (event: { venue?: { city: string } | null; privateCity?: string | null }): string | undefined =>
  event.venue?.city ?? event.privateCity ?? undefined;
