/** Read-only public catalog endpoints — same contract as
 * prebooze-web/src/api/index.ts's `catalog` export, no auth required. */
import { apiFetch } from './client';
import type { Event, LineupProfile, Organizer, Person, PersonDetail, PromoterProfile, Venue } from '../types';

export const catalog = {
  events: (q: { city?: string; cat?: string; sub?: string; search?: string; sort?: string; organizerId?: string; venueId?: string; includePast?: boolean }) =>
    apiFetch<Event[]>('/events', { query: q }),
  event: (slug: string) => apiFetch<Event>(`/events/${slug}`),
  venues: (city?: string) => apiFetch<Venue[]>('/venues', { query: { city } }),
  venue: (id: string) => apiFetch<Venue>(`/venues/${id}`),
  organizers: (city?: string) => apiFetch<Organizer[]>('/organizers', { query: { city } }),
  organizer: (id: string) => apiFetch<Organizer>(`/organizers/${id}`),
  promoters: (city?: string) => apiFetch<PromoterProfile[]>('/promoters', { query: { city } }),
  promoter: (slug: string) => apiFetch<PromoterProfile>(`/promoters/${slug}`),
  lineups: (city?: string) => apiFetch<LineupProfile[]>('/lineups', { query: { city } }),
  lineup: (slug: string) => apiFetch<LineupProfile>(`/lineups/${slug}`),
  people: (city?: string) => apiFetch<Person[]>('/people', { query: { city } }),
  person: (username: string) => apiFetch<PersonDetail>(`/people/${username}`),
  categories: () => apiFetch<{ name: string; icon: string; subs: string[] }[]>('/categories'),
  venueTypes: () => apiFetch<{ name: string; icon?: string; events: number }[]>('/venue-types'),
  cities: () => apiFetch<{ name: string; icon?: string; top: boolean; state?: string; events: number; venues: number; organizers: number }[]>('/cities'),
  search: (q: string) => apiFetch<{ label: string; type: string; to: string }[]>('/search', { query: { q } }),
  trending: () => apiFetch<string[]>('/search/trending'),
};
