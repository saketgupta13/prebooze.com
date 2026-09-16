/** Same contract as prebooze-web/src/api/index.ts's `social` export — only
 * the one endpoint this app needs (organizer's own reviews, read-only;
 * moderation is admin-only). */
import { apiFetch } from './client';
import type { GuestReview } from '../types';

export const social = {
  organizerReviews: (organizerId: string) => apiFetch<GuestReview[]>(`/organizers/${organizerId}/reviews`),
};
