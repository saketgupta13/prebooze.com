/** Same contract as prebooze-web/src/api/index.ts's `promoter` export —
 * only the one method the Scanner needs (confirming a promoter free-entry
 * guest at the door). */
import { apiFetch } from './client';

export const promoter = {
  checkInGuest: (id: string) => apiFetch<void>(`/promoter/guests/${id}/check-in`, { method: 'POST' }),
};
