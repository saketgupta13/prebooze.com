/** Client for the real /v1/organizer/notifications* endpoints — an
 * organizer-scoped in-app inbox, same contract as prebooze-api's
 * OrgNotificationsService. */
import { apiFetch } from './client';
import type { OrgNotification } from '../types';

export const notifications = {
  list: () => apiFetch<OrgNotification[]>('/organizer/notifications'),
  unreadCount: () => apiFetch<{ count: number }>('/organizer/notifications/unread-count'),
  markRead: (id: string) => apiFetch<OrgNotification>(`/organizer/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => apiFetch<{ ok: true }>('/organizer/notifications/read-all', { method: 'POST' }),
};
