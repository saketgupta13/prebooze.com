/** Real FAQ content + help-ticket system — same contract as
 * prebooze-web/src/api/index.ts's `catalog.faqs` and `support` exports. */
import { apiFetch } from './client';
import type { CmsFaq, HelpTicket, HelpTicketReply } from '../types';

export const faqs = {
  list: (audience: 'guests' | 'organizers' = 'guests') => apiFetch<CmsFaq[]>('/faqs', { query: { audience } }),
};

export const support = {
  tickets: () => apiFetch<HelpTicket[]>('/support/tickets'),
  raise: (t: { topic: string; subject: string; message: string }) => apiFetch<HelpTicket>('/support/tickets', { body: t }),
  ticket: (id: string) => apiFetch<HelpTicket>(`/support/tickets/${id}`),
  reply: (id: string, message: string) => apiFetch<HelpTicketReply>(`/support/tickets/${id}/reply`, { body: { message } }),
};
