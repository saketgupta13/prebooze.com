/** Same contract as prebooze-web/src/api/index.ts's `catalog` export — only
 * the methods the event wizard needs (venue/lineup/promoter rosters,
 * categories, cities). */
import { apiFetch } from './client';
import type { LineupProfile, PromoterProfile, Venue } from '../types';

export const catalog = {
  venues: (city?: string) => apiFetch<Venue[]>('/venues', { query: { city } }),
  lineups: () => apiFetch<LineupProfile[]>('/lineups'),
  promoters: () => apiFetch<PromoterProfile[]>('/promoters'),
  categories: () => apiFetch<{ name: string; icon: string; subs: string[] }[]>('/categories'),
  // `state` is real (each city is linked to a state via admin's Locations
  // hierarchy) but was missing from this type — needed by LocationPicker to
  // cascade City options under the selected State, same as web's.
  cities: () => apiFetch<{ name: string; state?: string }[]>('/cities'),
};
