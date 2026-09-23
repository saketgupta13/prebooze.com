import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CatalogService } from '../catalog/catalog.service';

const LIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'refund_requested'];
const HISTOGRAM_BUCKETS = 10;
const BUCKET_MS = 15 * 60 * 1000;
const SCAN_RATE_WINDOW_MS = 5 * 60 * 1000;

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

@Injectable()
export class LiveMonitorService {
  constructor(private prisma: PrismaService) {}

  /** Real-data half of the mock's Live Monitor ops screen — checked-in
   * count/%, arrivals histogram and the gate feed are all genuinely
   * computed from Booking/CheckInLog now, replacing the mock's simulated
   * setInterval feed (its own comment: "simulated locally until the
   * check-in websocket exists"). */
  async live(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const soldAgg = await this.prisma.booking.aggregate({
      where: { eventId, status: { in: LIVE_BOOKING_STATUSES } },
      _sum: { qty: true },
    });
    const ticketCheckedInAgg = await this.prisma.booking.aggregate({
      where: { eventId, status: 'confirmed', checkedIn: true },
      _sum: { qty: true },
    });
    const manualAgg = await this.prisma.checkInLog.aggregate({
      where: { eventId, ok: true, bookingId: null },
      _sum: { headcount: true },
    });

    const total = soldAgg._sum.qty ?? 0;
    const checkedIn = (ticketCheckedInAgg._sum.qty ?? 0) + (manualAgg._sum.headcount ?? 0);
    const remaining = Math.max(0, total - checkedIn);
    const pct = total > 0 ? Math.min(100, Math.round((checkedIn / total) * 100)) : 0;

    const rejected = await this.prisma.checkInLog.count({ where: { eventId, ok: false } });
    const recentOk = await this.prisma.checkInLog.count({ where: { eventId, ok: true, createdAt: { gte: new Date(Date.now() - SCAN_RATE_WINDOW_MS) } } });
    const scanRate = Math.round(recentOk / (SCAN_RATE_WINDOW_MS / 60000));

    const successLogs = await this.prisma.checkInLog.findMany({ where: { eventId, ok: true }, select: { createdAt: true }, orderBy: { createdAt: 'asc' } });
    const histogram = new Array(HISTOGRAM_BUCKETS).fill(0);
    if (successLogs.length) {
      const start = successLogs[0].createdAt.getTime();
      for (const log of successLogs) {
        const bucket = Math.min(HISTOGRAM_BUCKETS - 1, Math.floor((log.createdAt.getTime() - start) / BUCKET_MS));
        histogram[bucket]++;
      }
    }

    const feedLogs = await this.prisma.checkInLog.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 8 });
    // bookingId lets the RN client offer a revert action on a real matched
    // check-in — a walk-up/rejected entry has none, nothing to revert.
    const feed = feedLogs.map((l) => ({
      ok: l.ok,
      text: l.ok ? `✓ ${l.guestName ?? 'Guest'} · ${l.tierName ?? l.reason}` : `✕ ${l.reason}`,
      at: l.createdAt,
      bookingId: l.bookingId ?? undefined,
    }));

    return { total, checkedIn, remaining, pct, scanRate, rejected, histogram, feed, salesPaused: event.salesPaused };
  }

  /** "Check all events" overview (2026-09-02) — the single-event live()
   * above was the only way to see gate stats, and nothing in admin ever
   * linked to it (the route sat completely orphaned — reachable only by
   * typing a URL with a known event id by hand). This gives every
   * currently-relevant event's checked-in/% in one screen, grouped queries
   * instead of N sequential calls to live() per event. "Relevant" = same
   * window definition LiveMonitor.tsx's own default-event picker already
   * uses (hasn't ended yet — durationHrs-aware, not just date-based), so an
   * event that's already started but not finished, or hasn't started yet
   * today, both show up; a long-past event never does. */
  async overviewAll() {
    const now = Date.now();
    const events = await this.prisma.event.findMany({
      where: { status: 'approved' },
      select: {
        id: true, title: true, date: true, durationHrs: true, seriesEndDate: true, salesPaused: true,
        venue: { select: { name: true, city: true } }, privateCity: true,
      },
    });
    const relevant = events.filter((e) => !CatalogService.isEventOver(e, new Date(now)));
    if (!relevant.length) return [];

    const eventIds = relevant.map((e) => e.id);
    const [soldAgg, checkedInAgg, manualAgg, rejectedAgg] = await Promise.all([
      this.prisma.booking.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds }, status: { in: LIVE_BOOKING_STATUSES } }, _sum: { qty: true } }),
      this.prisma.booking.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds }, status: 'confirmed', checkedIn: true }, _sum: { qty: true } }),
      this.prisma.checkInLog.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds }, ok: true, bookingId: null }, _sum: { headcount: true } }),
      this.prisma.checkInLog.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds }, ok: false }, _count: { _all: true } }),
    ]);
    const soldByEvent = new Map(soldAgg.map((r) => [r.eventId, r._sum.qty ?? 0]));
    const ticketCheckedInByEvent = new Map(checkedInAgg.map((r) => [r.eventId, r._sum.qty ?? 0]));
    const manualByEvent = new Map(manualAgg.map((r) => [r.eventId ?? '', r._sum.headcount ?? 0]));
    const rejectedByEvent = new Map(rejectedAgg.map((r) => [r.eventId ?? '', r._count._all]));

    return relevant
      .map((e) => {
        const total = soldByEvent.get(e.id) ?? 0;
        const checkedIn = (ticketCheckedInByEvent.get(e.id) ?? 0) + (manualByEvent.get(e.id) ?? 0);
        const isRunning = e.date.getTime() <= now && now < e.date.getTime() + e.durationHrs * 3600000;
        return {
          id: e.id,
          title: e.title,
          date: e.date,
          durationHrs: e.durationHrs,
          city: e.venue?.city ?? e.privateCity ?? null,
          venueName: e.venue?.name ?? null,
          salesPaused: e.salesPaused,
          isRunning,
          total,
          checkedIn,
          pct: total > 0 ? Math.min(100, Math.round((checkedIn / total) * 100)) : 0,
          rejected: rejectedByEvent.get(e.id) ?? 0,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /** Front-desk fallback for walk-ups with no online booking, or admins
   * checking a guest in by name/booking id instead of scanning a QR. If the
   * input resolves to a real confirmed, not-yet-checked-in booking on this
   * event, that booking is checked in for real (same as a QR scan); otherwise
   * it's logged as a manual/walk-up admission with the given headcount. */
  async manualCheckIn(eventId: string, name: string, count?: number) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (!name?.trim()) throw new BadRequestException('Guest name or booking # is required');
    const headcount = Math.max(1, Math.min(10, count ?? 1));

    const trimmed = name.trim();
    const booking = await this.prisma.booking.findFirst({
      where: { eventId, id: trimmed.startsWith('#') ? trimmed : `#${trimmed}` },
    });
    if (booking) {
      if (booking.status !== 'confirmed') throw new BadRequestException(`Ticket is ${booking.status}, not valid for entry`);
      // Real gap (2026-09-23): a multi-day event (Event.seriesEndDate set)
      // had no way to re-admit a guest on day 2/3 — checkedIn was a
      // lifetime-once flag, so day 1's check-in permanently blocked every
      // later day. checkedInAt not being from *today* now means "not
      // checked in yet today," letting the update below proceed instead of
      // rejecting — single-day events (no seriesEndDate) keep the exact
      // original always-reject behavior. CheckInLog's append-only history
      // (below) is what preserves day 1's real attendance record even
      // though checkedInAt itself only ever holds the latest day's stamp.
      const alreadyToday = booking.checkedIn && (!event.seriesEndDate || isSameCalendarDay(booking.checkedInAt!, new Date()));
      if (alreadyToday) throw new BadRequestException('Already checked in — ' + booking.checkedInAt?.toISOString());
      // Same conditional-update race guard as BookingsService.checkIn — a
      // manual lookup here can race a real camera scan of the same booking.
      // checkedIn:false OR checkedInAt < today's start covers both the
      // never-checked-in case and the multi-day re-admission case above.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const result = await this.prisma.booking.updateMany({
        where: { id: booking.id, OR: [{ checkedIn: false }, { checkedInAt: { lt: todayStart } }] },
        data: { checkedIn: true, checkedInAt: new Date() },
      });
      if (result.count === 0) {
        const latest = await this.prisma.booking.findUnique({ where: { id: booking.id } });
        throw new BadRequestException('Already checked in — ' + latest?.checkedInAt?.toISOString());
      }
      return this.prisma.checkInLog.create({
        data: { eventId, bookingId: booking.id, ok: true, reason: 'manual check-in', guestName: booking.mainGuest, tierName: booking.tierName, headcount: booking.qty },
      });
    }

    return this.prisma.checkInLog.create({
      data: { eventId, ok: true, reason: 'manual check-in — walk-up', guestName: trimmed, headcount },
    });
  }

  /** Undo a manual check-in — real gap (2026-09-23), staff had no way to fix
   * a mis-entry made via Live Monitor. Deliberately scoped to Live
   * Monitor's manual check-in only, not the camera/QR scanner path
   * (BookingsService.checkIn) — organizer explicitly wants the scanner
   * untouched. Allowed any time the event is still live, not just
   * pre-start, so it's actually useful for fixing a real-time mistake at
   * the gate. */
  async revertCheckIn(eventId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.eventId !== eventId) throw new NotFoundException('Booking not found');
    if (!booking.checkedIn) throw new BadRequestException('This booking is not checked in');
    await this.prisma.booking.update({ where: { id: bookingId }, data: { checkedIn: false, checkedInAt: null } });
    return this.prisma.checkInLog.create({
      data: { eventId, bookingId, ok: true, reason: 'check-in reverted by organizer', guestName: booking.mainGuest, tierName: booking.tierName, headcount: booking.qty },
    });
  }
}
