/** Same contract as prebooze-web/src/api/index.ts's `bookings` export —
 * only the one method the Scanner needs. Booking ids contain a literal "#"
 * (e.g. "#TKT-12345"); checkIn() itself doesn't need encoding since the id
 * isn't in the URL — the signed QR token is sent in the body instead. */
import { apiFetch } from './client';
import type { Booking } from '../types';

export const bookings = {
  checkIn: (token: string) => apiFetch<Booking>('/bookings/check-in', { body: { token } }),
};
