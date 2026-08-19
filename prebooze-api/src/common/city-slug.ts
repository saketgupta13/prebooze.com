/** Matches prebooze-web's identical `toCitySlug` (src/lib/urls.ts) — kept
 * as two small duplicated pure functions rather than a shared package,
 * since there's no existing shared-code mechanism between the two repos.
 * Used to build city-prefixed sitemap/share URLs, and (in
 * admin/locations.service.ts) to guard against two cities colliding on
 * the same slug — City.name is the primary key with no dedicated slug
 * field and no admin-side URL-safety validation today. */
export const toCitySlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
