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

/** First-touch attribution — referrer host, UTM params, and landing page,
 * captured once (same "set once, reused for the life of the browser" rule
 * as sessionId above) and resent on every track() call so every row this
 * browser ever produces carries the same "how did they arrive" info,
 * without a second write path or a risk of later calls silently losing it
 * once the visitor has navigated away from the actual landing page/URL. */
const ATTR_KEY = 'pb_track_attribution';

interface Attribution {
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPath?: string;
  // Meta's {{site_source_name}} dynamic param — resolves to "fb"/"ig" at
  // click time, appended as site_source on ad destination URLs.
  siteSource?: string;
}

function attribution(): Attribution {
  const stored = localStorage.getItem(ATTR_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Attribution;
    } catch {
      // corrupt value — fall through and recompute below
    }
  }
  let referrerHost: string | undefined;
  try {
    referrerHost = document.referrer ? new URL(document.referrer).hostname : undefined;
  } catch {
    referrerHost = undefined;
  }
  const params = new URLSearchParams(window.location.search);
  const attr: Attribution = {
    referrerHost,
    utmSource: params.get('utm_source') ?? undefined,
    utmMedium: params.get('utm_medium') ?? undefined,
    utmCampaign: params.get('utm_campaign') ?? undefined,
    siteSource: params.get('site_source') ?? undefined,
    landingPath: window.location.pathname,
  };
  localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
  return attr;
}

export function track(type: string, opts?: { eventId?: string; meta?: Record<string, unknown> }): void {
  if (!isBackendEnabled()) return;
  apiFetch('/track', {
    body: { sessionId: sessionId(), type, eventId: opts?.eventId, meta: opts?.meta, ...attribution() },
  }).catch(() => {});
}

/** Same first-touch attribution `track()` sends, for embedding directly into
 * a KYC/role application's own payload — so a reviewer looking at a pending
 * application in Admin > Verifications can see where the lead actually came
 * from (e.g. a paid Meta campaign) without cross-referencing a separate
 * analytics table by session/timestamp. Only returns fields that are
 * actually present, so an organic/direct visitor's application doesn't grow
 * a payload full of `undefined` marketing fields. */
export function attributionForPayload(): Record<string, string> {
  const a = attribution();
  const out: Record<string, string> = {};
  if (a.utmSource) out.utmSource = a.utmSource;
  if (a.utmMedium) out.utmMedium = a.utmMedium;
  if (a.utmCampaign) out.utmCampaign = a.utmCampaign;
  if (a.siteSource) out.siteSource = a.siteSource;
  if (a.referrerHost) out.referrerHost = a.referrerHost;
  return out;
}
