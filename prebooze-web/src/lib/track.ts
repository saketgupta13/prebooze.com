import { apiFetch, isBackendEnabled } from '../api/client';

/** Booking-funnel visibility (see FunnelEvent in the API's schema.prisma) —
 * a stable per-browser id, set once and reused for the life of the browser
 * (not per-login), so a visitor's pre-auth steps (viewed the event, clicked
 * book) join up with what they do after logging in. Never blocks or throws:
 * every call site fires this and moves on regardless of the result. */
const SESSION_KEY = 'pb_track_session';

function sessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function track(type: string, opts?: { eventId?: string; meta?: Record<string, unknown> }): void {
  if (!isBackendEnabled()) return;
  apiFetch('/track', {
    body: { sessionId: sessionId(), type, eventId: opts?.eventId, meta: opts?.meta },
  }).catch(() => {});
}
