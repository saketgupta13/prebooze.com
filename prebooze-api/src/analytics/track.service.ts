import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
  landingPath?: string;
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

  async record(input: TrackInput, userId?: string, userAgent?: string) {
    if (!input.sessionId?.trim() || !input.type || !(FUNNEL_TYPES as readonly string[]).includes(input.type)) {
      return { ok: false };
    }
    const { device, browser, os } = parseUserAgent(userAgent ?? '');
    await this.prisma.funnelEvent
      .create({
        data: {
          sessionId: input.sessionId.trim().slice(0, 100),
          userId,
          type: input.type,
          eventId: input.eventId,
          meta: input.meta as Prisma.InputJsonValue | undefined,
          device,
          browser,
          os,
          referrerHost: input.referrerHost?.slice(0, 200),
          utmSource: input.utmSource?.slice(0, 100),
          utmMedium: input.utmMedium?.slice(0, 100),
          utmCampaign: input.utmCampaign?.slice(0, 100),
          landingPath: input.landingPath?.slice(0, 300),
        },
      })
      .catch((err) => this.log.warn(`Failed to record ${input.type}: ${(err as Error).message}`));
    return { ok: true };
  }
}
