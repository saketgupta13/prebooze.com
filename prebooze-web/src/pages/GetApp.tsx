import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

const IOS_URL = 'https://apps.apple.com/in/app/prebooze/id6830486402';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.prebooze.guest';

/** Real single shareable link (prebooze.com/app) for the guest app — one URL
 * to put on a poster/bio/ad instead of two separate store badges. Detects
 * the visiting device from its own user agent and redirects straight to
 * the matching store; a desktop/unrecognized visitor gets both badges
 * instead of a dead redirect, same as the footer/checkout nudge already
 * show. No tracking/attribution layer here — if that's ever needed later
 * (per-channel install attribution), this is the one place that would grow
 * it, not a reason to delay a plain redirect today. */
function detectStore(ua: string): 'ios' | 'android' | null {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return null;
}

export default function GetApp() {
  const [store] = useState(() => detectStore(navigator.userAgent));

  useEffect(() => {
    if (store === 'ios') window.location.replace(IOS_URL);
    else if (store === 'android') window.location.replace(ANDROID_URL);
  }, [store]);

  if (store) return null; // mid-redirect — nothing to render

  return (
    <main className="page">
      <div className="container center" style={{ padding: '72px 0', textAlign: 'center' }}>
        <Smartphone size={40} className="accent" style={{ marginBottom: 16 }} />
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Get the Prebooze app</h1>
        <p className="muted" style={{ marginBottom: 24 }}>Pick your platform below.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          <a href={IOS_URL}>
            <img src="/badges/app-store.svg" alt="Download the Prebooze Guest app on the App Store" height={44} />
          </a>
          <a href={ANDROID_URL}>
            <img src="/badges/google-play.svg" alt="Download the Prebooze Guest app on Google Play" height={44} />
          </a>
        </div>
      </div>
    </main>
  );
}
