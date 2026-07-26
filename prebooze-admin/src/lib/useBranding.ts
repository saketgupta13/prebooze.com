import { useEffect, useState } from 'react';
import { liveApiEnabled, livePublicBranding } from './liveApi';

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}

/** Admin-uploaded logo/favicon (Settings → Branding), read via the same
 * unauthenticated GET /settings prebooze-web uses — works even on the
 * pre-login screen, unlike the staff-authed liveSettings.get(). Falls back
 * to (and starts rendering immediately with) the static /logo.png. */
export function useBranding(): { logoUrl: string | null } {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!liveApiEnabled()) return;
    livePublicBranding
      .get()
      .then((b) => {
        setLogoUrl(b.logoUrl?.trim() || null);
        setFavicon(b.faviconUrl?.trim() || '/logo.png');
      })
      .catch(() => {});
  }, []);
  return { logoUrl };
}
