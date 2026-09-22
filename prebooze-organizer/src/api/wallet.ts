/** Client for the real /v1/pay-methods endpoints — shared across every
 * role (not organizer-specific), same contract as prebooze-web's
 * `wallet` api object. JwtAuthGuard-only, no org-scoping needed. */
import { apiFetch } from './client';
import type { PayMethod } from '../types';

export const wallet = {
  payMethods: () => apiFetch<PayMethod[]>('/pay-methods'),
  addPayMethod: (m: Omit<PayMethod, 'id' | 'isDefault'>) => apiFetch<PayMethod>('/pay-methods', { body: m }),
  removePayMethod: (id: string) => apiFetch<void>(`/pay-methods/${id}`, { method: 'DELETE' }),
  setDefault: (id: string) => apiFetch<void>(`/pay-methods/${id}/default`, { method: 'POST' }),
};
