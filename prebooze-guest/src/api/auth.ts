/** Same contract as prebooze-web/src/api/index.ts's `auth` export and
 * prebooze-organizer's identical file — phone + 4-digit WhatsApp OTP, JWT
 * session. Shared across every Prebooze role; nothing here is guest-only. */
import { apiFetch, apiUpload } from './client';
import type { User } from '../types';

export const auth = {
  requestOtp: (phone: string) => apiFetch<{ requestId: string; devCode?: string; existingName?: string }>('/auth/otp', { body: { phone } }),
  verifyOtp: (requestId: string, code: string, name?: string, marketingConsent?: boolean) =>
    apiFetch<{ token: string; user: User; isNew: boolean }>('/auth/verify', {
      body: { requestId, code, name, marketingConsent: marketingConsent ?? false },
    }),
  me: () => apiFetch<User>('/me'),
  updateMe: (patch: Partial<User>) => apiFetch<User>('/me', { method: 'PATCH', body: patch }),
  // Expo's own global fetch only accepts a real Blob in FormData, not RN's
  // classic {uri,name,type} part — same fix prebooze-organizer's upload
  // already needed (confirmed against a real upload there 2026-09-15).
  upload: async (uri: string, name: string, mimeType: string) => {
    const blob = await fetch(uri).then((r) => r.blob());
    const form = new FormData();
    form.append('file', blob, name);
    return apiUpload<{ url: string }>('/me/upload', form);
  },
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
  deleteAccount: () => apiFetch<{ ok: boolean }>('/me/delete', { method: 'POST' }),
  requestPhoneChange: (newPhone: string) => apiFetch<{ requestId: string; devCode?: string }>('/me/phone/request-change', { body: { newPhone } }),
  confirmPhoneChange: (requestId: string, code: string) => apiFetch<User>('/me/phone/confirm-change', { body: { requestId, code } }),
  /** Awards (or, if already claimed, just re-returns) the one-time 10%-off
   * coupon for finishing the soft-required "complete your profile" step. */
  claimProfileReward: () => apiFetch<{ code: string; maxDiscount: number; validTill: string; alreadyClaimed: boolean }>('/me/complete-profile-reward', { method: 'POST' }),
  // Lives under /organizer/push-token in the backend's route tree, but the
  // handler is generic — any authenticated user, not organizer-gated (see
  // OrganizerController.registerPushToken's own comment). Reusing the exact
  // same route rather than duplicating a second push-token endpoint.
  // `app: 'guest'` tells the backend which Expo project this token
  // belongs to (this route is shared with the organizer app, a different
  // Expo project — see PushToken.app's own schema comment for the real
  // bug this fixes: mixing tokens from two projects in one Expo batch
  // call makes Expo reject the WHOLE call, silently dropping every push).
  registerPushToken: (token: string, platform: string) => apiFetch<void>('/organizer/push-token', { body: { token, platform, app: 'guest' } }),
  unregisterPushToken: (token: string) => apiFetch<void>('/organizer/push-token', { method: 'DELETE', body: { token } }),
};
