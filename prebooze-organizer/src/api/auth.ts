/** Same contract as prebooze-web/src/api/index.ts's `auth` export —
 * phone + 4-digit WhatsApp OTP, JWT session. */
import { apiFetch } from './client';
import type { User } from '../types';

export const auth = {
  requestOtp: (phone: string) => apiFetch<{ requestId: string; devCode?: string; existingName?: string }>('/auth/otp', { body: { phone } }),
  verifyOtp: (requestId: string, code: string, name?: string, marketingConsent?: boolean) =>
    apiFetch<{ token: string; user: User; isNew: boolean }>('/auth/verify', {
      body: { requestId, code, name, marketingConsent: marketingConsent ?? false },
    }),
  me: () => apiFetch<User>('/me'),
  updateMe: (patch: Partial<User>) => apiFetch<User>('/me', { method: 'PATCH', body: patch }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
  requestPhoneChange: (newPhone: string) => apiFetch<{ requestId: string; devCode?: string }>('/me/phone/request-change', { body: { newPhone } }),
  confirmPhoneChange: (requestId: string, code: string) => apiFetch<User>('/me/phone/confirm-change', { body: { requestId, code } }),
};
