import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FUNNEL_TYPES } from './track.service';

/** Real booking-funnel analytics off FunnelEvent — see that model's comment
 * for what's actually tracked (8 booking-flow steps, sessionId + optional
 * eventId + a JSON meta bag; no device/browser/referrer is captured, so
 * this deliberately doesn't pretend to show dimensions nothing collects).
 * Counts are *distinct sessions* that reached each stage, not raw event
 * fires — a reload doesn't inflate the numbers, same as a real funnel tool. */
@Injectable()
export class AnalyticsReportService {
  constructor(private prisma: PrismaService) {}

  /** City/organizer filters go through Event (FunnelEvent has no city/
   * organizerId of its own) — resolves to the set of matching event ids
   * first, then filters FunnelEvent by that set alongside any explicit
   * eventId. A filter that matches zero events correctly zeroes out the
   * whole report rather than silently ignoring the filter. */
  private async resolveEventIds(city?: string, organizerId?: string): Promise<string[] | undefined> {
    if (!city && !organizerId) return undefined;
    const events = await this.prisma.event.findMany({
      where: {
        ...(organizerId ? { organizerId } : {}),
        ...(city ? { OR: [{ privateCity: city }, { venue: { city } }] } : {}),
      },
      select: { id: true },
    });
    return events.map((e) => e.id);
  }

  async get(params: { from?: string; to?: string; eventId?: string; city?: string; organizerId?: string }) {
    const scopedEventIds = await this.resolveEventIds(params.city, params.organizerId);

    const rows = await this.prisma.funnelEvent.findMany({
      where: {
        ...(params.eventId ? { eventId: params.eventId } : {}),
        ...(scopedEventIds ? { eventId: { in: scopedEventIds } } : {}),
        ...(params.from || params.to
          ? {
              createdAt: {
                ...(params.from ? { gte: new Date(params.from) } : {}),
                ...(params.to ? { lte: new Date(params.to) } : {}),
              },
            }
          : {}),
      },
      select: { type: true, sessionId: true, eventId: true, createdAt: true },
    });

    const stages = FUNNEL_TYPES.map((type) => ({
      type,
      sessions: new Set(rows.filter((r) => r.type === type).map((r) => r.sessionId)).size,
    }));

    // Daily trend — distinct sessions per day for the funnel's top (viewed)
    // and bottom (completed) stages, the two numbers that actually matter
    // for a trend line: traffic in, conversions out.
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const dailyMap = new Map<string, { viewed: Set<string>; completed: Set<string> }>();
    for (const r of rows) {
      if (r.type !== 'event_viewed' && r.type !== 'booking_completed') continue;
      const key = dayKey(r.createdAt);
      const bucket = dailyMap.get(key) ?? { viewed: new Set<string>(), completed: new Set<string>() };
      (r.type === 'event_viewed' ? bucket.viewed : bucket.completed).add(r.sessionId);
      dailyMap.set(key, bucket);
    }
    const daily = [...dailyMap.entries()]
      .map(([date, b]) => ({ date, viewed: b.viewed.size, completed: b.completed.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top events by distinct viewing sessions, joined to real titles —
    // capped at 10, this is a ranking not a full export.
    const viewedRows = rows.filter((r) => r.type === 'event_viewed' && r.eventId);
    const completedRows = rows.filter((r) => r.type === 'booking_completed' && r.eventId);
    const byEvent = new Map<string, { viewed: Set<string>; completed: Set<string> }>();
    for (const r of viewedRows) {
      const b = byEvent.get(r.eventId!) ?? { viewed: new Set<string>(), completed: new Set<string>() };
      b.viewed.add(r.sessionId);
      byEvent.set(r.eventId!, b);
    }
    for (const r of completedRows) {
      const b = byEvent.get(r.eventId!) ?? { viewed: new Set<string>(), completed: new Set<string>() };
      b.completed.add(r.sessionId);
      byEvent.set(r.eventId!, b);
    }
    const topEventIds = [...byEvent.entries()].sort((a, b) => b[1].viewed.size - a[1].viewed.size).slice(0, 10);
    const eventTitles = await this.prisma.event.findMany({
      where: { id: { in: topEventIds.map(([id]) => id) } },
      select: { id: true, title: true, organizer: { select: { brandName: true } } },
    });
    const titleById = new Map(eventTitles.map((e) => [e.id, e]));
    const topEvents = topEventIds.map(([id, b]) => ({
      eventId: id,
      title: titleById.get(id)?.title ?? id,
      organizerBrand: titleById.get(id)?.organizer.brandName ?? '',
      viewed: b.viewed.size,
      completed: b.completed.size,
      conversionPct: b.viewed.size ? Math.round((b.completed.size / b.viewed.size) * 100) : 0,
    }));

    return { stages, totalEvents: rows.length, daily, topEvents };
  }

  /** "Right now" — distinct sessions with any funnel activity in the last 5
   * minutes, same live-traffic idea as a real analytics tool's realtime
   * view, built off exactly what's tracked rather than inventing dimensions
   * (device/location/etc) nothing here actually captures. Poll this on an
   * interval from the frontend; it's not a push/websocket feed. */
  async realtime() {
    const since = new Date(Date.now() - 5 * 60 * 1000);
    const rows = await this.prisma.funnelEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { sessionId: true, type: true, eventId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const activeSessions = new Set(rows.map((r) => r.sessionId)).size;
    const byType = FUNNEL_TYPES.map((type) => ({
      type,
      sessions: new Set(rows.filter((r) => r.type === type).map((r) => r.sessionId)).size,
    }));
    const eventIds = [...new Set(rows.map((r) => r.eventId).filter((id): id is string => !!id))];
    const events = await this.prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, title: true } });
    const titleById = new Map(events.map((e) => [e.id, e.title]));
    const recent = rows.slice(0, 20).map((r) => ({
      type: r.type,
      eventTitle: r.eventId ? titleById.get(r.eventId) ?? null : null,
      at: r.createdAt.toISOString(),
    }));
    return { since: since.toISOString(), activeSessions, byType, recent };
  }

  /** Options for the filter dropdowns — real organizers/cities/events, not
   * a hardcoded list, and includes each event's own city/organizerId so the
   * frontend can cascade the event dropdown down to whatever's already
   * selected without another round trip. */
  async filters() {
    const events = await this.prisma.event.findMany({
      select: { id: true, title: true, organizerId: true, privateCity: true, venue: { select: { city: true } } },
      orderBy: { date: 'desc' },
    });
    const organizers = await this.prisma.organizer.findMany({ select: { id: true, brandName: true }, orderBy: { brandName: 'asc' } });
    const cities = [...new Set(events.map((e) => e.privateCity ?? e.venue?.city).filter((c): c is string => !!c))].sort();
    return {
      organizers,
      cities,
      events: events.map((e) => ({ id: e.id, title: e.title, organizerId: e.organizerId, city: e.privateCity ?? e.venue?.city ?? null })),
    };
  }
}
