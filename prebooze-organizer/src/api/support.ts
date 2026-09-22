/** Client for the real /v1/support/tickets endpoints — shared across
 * every role, same contract as prebooze-web's `support` api object. */
import { apiFetch } from './client';
import type { HelpTicket } from '../types';

export const support = {
  tickets: () => apiFetch<HelpTicket[]>('/support/tickets'),
  raise: (t: Omit<HelpTicket, 'id' | 'status' | 'createdAt'>) => apiFetch<HelpTicket>('/support/tickets', { body: t }),
};
