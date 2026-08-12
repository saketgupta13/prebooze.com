import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import geoip from 'geoip-lite';
import { PrismaService } from '../prisma.service';

export const FUNNEL_TYPES = [
  'event_viewed',
  'book_clicked',
  'otp_requested',
  'otp_verified',
  'checkout_viewed',
  'payment_widget_opened',
  'payment_submitted',
  'booking_completed',
] as const;

/** Side events, not sequential funnel stages — recorded so we can see *why*
 * people drop off at payment, not just that they did, without treating them
 * as another waterfall bar. Checked separately from FUNNEL_TYPES below. */
export const EXTRA_TYPES = ['payment_failed'] as const;

interface TrackInput {
  sessionId?: string;
  type?: string;
  eventId?: string;
  meta?: Record<string, unknown>;
  // First-touch attribution, captured once per session client-side
  // (lib/track.ts) and resent on every call so every row carries the same
  // "how did they arrive" info without a second write path.
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  siteSource?: string;
  landingPath?: string;
}

/** Offline IP -> city/region/country lookup (geoip-lite ships its own local
 * database, no external API call/key). Only the resolved labels are stored
 * on FunnelEvent, never the raw IP — same "derive once, keep the label"
 * move as parseUserAgent below. Private/local/unresolvable IPs (dev
 * environment, LAN) correctly resolve to nothing rather than a fake city. */
function lookupGeo(ip: string | undefined): { geoCountry?: string; geoRegion?: string; geoCity?: string } {
  if (!ip) return {};
  const clean = ip.replace(/^::ffff:/, '').split(',')[0].trim();
  const geo = geoip.lookup(clean);
  if (!geo) return {};
  return { geoCountry: geo.country || undefined, geoRegion: geo.region || undefined, geoCity: geo.city || undefined };
}

/** Coarse, dependency-free User-Agent parsing — covers the handful of
 * device/browser/OS categories that actually matter for a breakdown chart,
 * not a byte-for-byte UA database. Order matters: check the more specific
 * pattern (e.g. Edge, which also contains "Chrome") before the generic one
 * it'd otherwise be misclassified as. Never trusted for anything beyond
 * reporting — this is analytics, not a security decision. */
function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  const u = ua || '';

  const device = /iPad|Tablet(?!.*Mobile)/i.test(u)
    ? 'tablet'
    : /Mobi|Android(?=.*Mobile)|iPhone|iPod/i.test(u)
      ? 'mobile'
      : 'desktop';

  const browser = /Edg\//i.test(u)
    ? 'Edge'
    : /OPR\/|Opera/i.test(u)
      ? 'Opera'
      : /SamsungBrowser/i.test(u)
        ? 'Samsung Internet'
        : /FBAN|FBAV|Instagram/i.test(u)
          ? 'In-app browser'
          : /Firefox\//i.test(u)
            ? 'Firefox'
            : /Chrome\//i.test(u)
              ? 'Chrome'
              : /Safari\//i.test(u)
                ? 'Safari'
                : 'Other';

  const os = /iPhone|iPad|iPod/i.test(u)
    ? 'iOS'
    : /Android/i.test(u)
      ? 'Android'
      : /Windows/i.test(u)
        ? 'Windows'
        : /Mac OS X|Macintosh/i.test(u)
          ? 'macOS'
          : /Linux/i.test(u)
            ? 'Linux'
            : 'Other';

  return { device, browser, os };
}

/** Booking-funnel visibility — see FunnelEvent in schema.prisma for why this
 * exists. Deliberately never throws back to the caller: a tracking write is
 * never allowed to surface as a user-visible error or block the real action
 * it's observing, so every failure is logged and swallowed here rather than
 * left to each call site's own .catch(() => {}). */
@Injectable()
export class TrackService {
  private readonly log = new Logger('Track');

  constructor(private prisma: PrismaService) {}

  async record(input: TrackInput, userId?: string, userAgent?: string, ip?: string) {
    const isKnownType =
      !!input.type &&
      ((FUNNEL_TYPES as readonly string[]).includes(input.type) || (EXTRA_TYPES as readonly string[]).includes(input.type));
    if (!input.sessionId?.trim() || !isKnownType) {
      return { ok: false };
    }
    const { device, browser, os } = parseUserAgent(userAgent ?? '');
    const { geoCountry, geoRegion, geoCity } = lookupGeo(ip);
    await this.prisma.funnelEvent
      .create({
        data: {
          sessionId: input.sessionId.trim().slice(0, 100),
          userId,
          type: input.type!,
          eventId: input.eventId,
          meta: input.meta as Prisma.InputJsonValue | undefined,
          device,
          browser,
          os,
          referrerHost: input.referrerHost?.slice(0, 200),
          utmSource: input.utmSource?.slice(0, 100),
          utmMedium: input.utmMedium?.slice(0, 100),
          utmCampaign: input.utmCampaign?.slice(0, 100),
          siteSource: input.siteSource?.slice(0, 100),
          landingPath: input.landingPath?.slice(0, 300),
          geoCountry,
          geoRegion,
          geoCity,
        },
      })
      .catch((err) => this.log.warn(`Failed to record ${input.type}: ${(err as Error).message}`));
    return { ok: true };
  }
}
