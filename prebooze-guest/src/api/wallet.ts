/** Wallet balance/transactions + saved payment methods — same contract as
 * prebooze-web/src/api/index.ts's `wallet` export. */
import { apiFetch } from './client';
import type { PayMethod, WalletTx } from '../types';

export const wallet = {
  balance: () => apiFetch<{ balance: number; txs: WalletTx[] }>('/wallet'),
  payMethods: () => apiFetch<PayMethod[]>('/pay-methods'),
  addPayMethod: (m: Omit<PayMethod, 'id' | 'isDefault'> & { cvvToken?: string }) => apiFetch<PayMethod>('/pay-methods', { body: m }),
  removePayMethod: (id: string) => apiFetch<void>(`/pay-methods/${id}`, { method: 'DELETE' }),
  setDefault: (id: string) => apiFetch<void>(`/pay-methods/${id}/default`, { method: 'POST' }),
};

export const referrals = {
  mine: () => apiFetch<{ code: string; referrals: import('../types').Referral[] }>('/referrals'),
  claim: (code: string) => apiFetch<void>('/referrals/claim', { body: { code } }),
};
