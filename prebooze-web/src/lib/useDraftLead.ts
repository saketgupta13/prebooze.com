import { useEffect, useRef } from 'react';
import { leadDraft } from '../api';
import { isBackendEnabled } from '../api/client';
import { attributionForPayload } from './track';

const DEBOUNCE_MS = 3000;

/** Captures an in-progress role application as a draft Lead, two ways:
 * once on mount (a logged-in visitor reaching the page at all is worth
 * knowing about, even with zero fields filled — they may never type
 * anything before leaving), and again, debounced, whenever `name` changes
 * (enriches the same row once they've actually started filling the form).
 * Both are fire-and-forget — a failure here must never affect the real
 * onboarding flow, so every call swallows its own errors. */
export function useDraftLead(role: 'organizer' | 'promoter' | 'lineup' | 'venue', name: string, extra?: { city?: string; eventType?: string }) {
  const firedInitial = useRef(false);
  // Re-read on every call rather than hoisted to a module constant — extra
  // (city/eventType) can change after mount as the form fills in, and a
  // stale closure here would keep re-sending whatever was true at mount.
  const extraRef = useRef(extra);
  extraRef.current = extra;

  useEffect(() => {
    if (!isBackendEnabled() || firedInitial.current) return;
    firedInitial.current = true;
    const attr = attributionForPayload();
    leadDraft.capture(role, { utmSource: attr.utmSource, utmMedium: attr.utmMedium }).catch(() => {});
    // Fires exactly once per mount, deliberately not depending on `role`
    // changing mid-session (a visitor doesn't switch onboarding forms
    // without a full navigation/remount anyway).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isBackendEnabled() || !name.trim()) return;
    const t = setTimeout(() => {
      const attr = attributionForPayload();
      leadDraft.capture(role, { name, city: extraRef.current?.city, eventType: extraRef.current?.eventType, utmSource: attr.utmSource, utmMedium: attr.utmMedium }).catch(() => {});
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [role, name]);
}
