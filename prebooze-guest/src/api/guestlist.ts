/** The free-entry guest-list flow (join a promoter's list, fetch the
 * resulting pass) — public, no auth, same contract as web's
 * `promoter.captureGuest`/`promoter.pass`. The guest reaches these by
 * opening a promoter's shared link, before/without ever logging in. */
import { apiFetch } from './client';
import type { PromoterGuest, PromoterPass } from '../types';

export const guestList = {
  join: (eventSlug: string, promoterSlug: string, guest: { name: string; phone: string; age: string; gender: string; companions?: { name: string }[] }) =>
    apiFetch<PromoterGuest>(`/p/${eventSlug}/${promoterSlug}`, { body: guest }),
  pass: (id: string) => apiFetch<PromoterPass>(`/p/pass/${id}`),
};
