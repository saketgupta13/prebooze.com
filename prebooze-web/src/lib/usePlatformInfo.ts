import { useEffect, useState } from 'react';
import { platform, type PlatformInfo } from '../api';
import { isBackendEnabled } from '../api/client';

/** Same defaults the app already showed before this was ever wired to a
 * real backend — kept as the fallback so offline/mock mode (VITE_API_URL
 * unset) and any field the admin genuinely left blank both still render
 * something real instead of empty. Live values win per-field, not
 * all-or-nothing, so a partially-configured backend doesn't blank out
 * fields nobody's touched yet. */
const FALLBACK: PlatformInfo = {
  maintenanceMode: false,
  comingSoonMode: false,
  socials: {
    instagram: 'https://instagram.com/prebooze',
    facebook: 'https://facebook.com/prebooze',
    x: 'https://x.com/prebooze',
    youtube: 'https://youtube.com/@prebooze',
    whatsapp: 'https://wa.me/919876543210',
  },
  siteSeo: { title: '', description: '', keywords: '' },
  contact: {
    email: 'help@prebooze.com',
    phone: '+91 98765 43210',
    address: '4th Floor, Cowork Hub, Koramangala, Bengaluru',
    organizerEmail: 'organizers@prebooze.com',
  },
  footerCopyright: `© ${new Date().getFullYear()} Prebooze Inc. · All rights reserved`,
  feeLabel: 'Booking fee',
  absorbedBy: 'Guest',
  bookingFee: 1.5,
  gstPct: 0,
  logoUrl: null,
  faviconUrl: null,
};

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}

function merge(live: Partial<PlatformInfo>): PlatformInfo {
  return {
    maintenanceMode: live.maintenanceMode ?? FALLBACK.maintenanceMode,
    comingSoonMode: live.comingSoonMode ?? FALLBACK.comingSoonMode,
    socials: { ...FALLBACK.socials, ...Object.fromEntries(Object.entries(live.socials ?? {}).filter(([, v]) => v)) },
    siteSeo: { ...FALLBACK.siteSeo, ...live.siteSeo },
    contact: { ...FALLBACK.contact, ...Object.fromEntries(Object.entries(live.contact ?? {}).filter(([, v]) => v)) },
    footerCopyright: live.footerCopyright?.trim() || FALLBACK.footerCopyright,
    feeLabel: live.feeLabel?.trim() || FALLBACK.feeLabel,
    absorbedBy: live.absorbedBy || FALLBACK.absorbedBy,
    bookingFee: live.bookingFee ?? FALLBACK.bookingFee,
    gstPct: live.gstPct ?? FALLBACK.gstPct,
    logoUrl: live.logoUrl?.trim() || FALLBACK.logoUrl,
    faviconUrl: live.faviconUrl?.trim() || FALLBACK.faviconUrl,
  };
}

/** Powers Footer/Contact (socials, contact details, copyright) from the
 * real, public `GET /settings` endpoint when a backend is configured —
 * falls back to (and starts rendering immediately with) the same static
 * values used before this was wired up. */
export function usePlatformInfo(): PlatformInfo {
  const [info, setInfo] = useState<PlatformInfo>(FALLBACK);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    platform.settings().then((live) => setInfo(merge(live))).catch(() => {});
  }, []);
  useEffect(() => {
    setFavicon(info.faviconUrl || '/prebooze-logo.png');
  }, [info.faviconUrl]);
  return info;
}
