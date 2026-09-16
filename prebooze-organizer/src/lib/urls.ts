/** Ported subset of prebooze-web/src/lib/urls.ts — only what the "view as
 * guest" link needs (the organizer app itself never routes on these, it
 * just opens the real guest site via Linking). */
import type { Event } from '../types';

export const SITE_ORIGIN = 'https://prebooze.com';

export const toCitySlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const eventPath = (city: string, slug: string): string => `/${toCitySlug(city)}/events/${slug}`;
export const organizerPath = (city: string, id: string): string => `/${toCitySlug(city)}/organizers/${id}`;

export const eventCity = (event: Event): string | undefined => event.venue?.city ?? event.privateCity ?? undefined;
