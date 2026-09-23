/** Client for the real /v1/support/tickets endpoints — shared across
 * every role, same contract as prebooze-web's `support` api object. */
import { apiFetch } from './client';
import type { HelpTicket, HelpTicketReply } from '../types';

export const support = {
  tickets: () => apiFetch<HelpTicket[]>('/support/tickets'),
  raise: (t: Omit<HelpTicket, 'id' | 'status' | 'createdAt'>) => apiFetch<HelpTicket>('/support/tickets', { body: t }),
  ticket: (id: string) => apiFetch<HelpTicket>(`/support/tickets/${id}`),
  reply: (id: string, message: string) => apiFetch<HelpTicketReply>(`/support/tickets/${id}/reply`, { body: { message } }),
};
