import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

const LIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'refund_requested'];
const HISTOGRAM_BUCKETS = 10;
const BUCKET_MS = 15 * 60 * 1000;
const SCAN_RATE_WINDOW_MS = 5 * 60 * 1000;

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
    const feed = feedLogs.map((l) => ({
      ok: l.ok,
      text: l.ok ? `✓ ${l.guestName ?? 'Guest'} · ${l.tierName ?? l.reason}` : `✕ ${l.reason}`,
      at: l.createdAt,
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
        id: true, title: true, date: true, durationHrs: true, salesPaused: true,
        venue: { select: { name: true, city: true } }, privateCity: true,
      },
    });
    const relevant = events.filter((e) => e.date.getTime() + e.durationHrs * 3600000 >= now);
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
      if (booking.checkedIn) throw new BadRequestException('Already checked in — ' + booking.checkedInAt?.toISOString());
      // Same conditional-update race guard as BookingsService.checkIn — a
      // manual lookup here can race a real camera scan of the same booking.
      const result = await this.prisma.booking.updateMany({
        where: { id: booking.id, checkedIn: false },
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
}
