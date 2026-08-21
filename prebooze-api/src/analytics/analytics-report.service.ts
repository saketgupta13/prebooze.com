import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FUNNEL_TYPES } from './track.service';

const SEARCH_HOSTS = ['google.', 'bing.', 'yahoo.', 'duckduckgo.', 'baidu.', 'yandex.'];
const SOCIAL_HOSTS = ['facebook.', 'instagram.', 'twitter.', 'x.com', 't.co', 'linkedin.', 'whatsapp.', 'pinterest.', 'reddit.', 'youtube.', 'snapchat.', 'tiktok.'];

/** geoip-lite's `region` is a bare ISO-3166-2 subdivision code with no
 * country attached ("OR" is Odisha in India *and* Oregon in the US) — every
 * event/venue on this platform is India-only, so the visitor-state
 * breakdown is deliberately scoped to geoCountry === 'IN' both to resolve
 * that ambiguity and to keep the list to states that are actually relevant
 * (the rest is mostly bot/VPN noise, not real prospective ticket buyers). */
const INDIAN_STATE_NAMES: Record<string, string> = {
  AN: 'Andaman and Nicobar Islands', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam',
  BR: 'Bihar', CH: 'Chandigarh', CT: 'Chhattisgarh', DN: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi', GA: 'Goa', GJ: 'Gujarat', HR: 'Haryana', HP: 'Himachal Pradesh', JK: 'Jammu and Kashmir',
  JH: 'Jharkhand', KA: 'Karnataka', KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep', MP: 'Madhya Pradesh',
  MH: 'Maharashtra', MN: 'Manipur', ML: 'Meghalaya', MZ: 'Mizoram', NL: 'Nagaland', OR: 'Odisha',
  PY: 'Puducherry', PB: 'Punjab', RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu',
  TG: 'Telangana', TS: 'Telangana', TR: 'Tripura', UP: 'Uttar Pradesh', UT: 'Uttarakhand', WB: 'West Bengal',
};
function indianStateName(code: string): string {
  return INDIAN_STATE_NAMES[code.toUpperCase()] ?? code;
}

/** direct = no referrer at all (typed the URL, opened a bookmark, or came
 * from a native app webview that strips it) · campaign = carries a real
 * utm_source, regardless of the referring host · search/social = referrer
 * host matches a known engine/platform · everything else with a referrer is
 * "referral". Computed on read, not stored, so recategorizing later doesn't
 * need a backfill. */
function trafficSourceOf(referrerHost: string | null, utmSource: string | null): string {
  if (utmSource) return 'campaign';
  if (!referrerHost) return 'direct';
  const h = referrerHost.toLowerCase();
  if (SEARCH_HOSTS.some((s) => h.includes(s))) return 'search';
  if (SOCIAL_HOSTS.some((s) => h.includes(s))) return 'social';
  return 'referral';
}

/** Meta's {{site_source_name}} dynamic param resolves to short platform
 * codes at click time — mapped to readable labels for the chart; anything
 * else passed through as-is (covers future placements/typos gracefully
 * rather than dropping the row into an "unknown" bucket). */
const SITE_SOURCE_LABELS: Record<string, string> = { fb: 'Facebook', ig: 'Instagram', an: 'Audience Network', msg: 'Messenger' };
function siteSourceLabel(raw: string): string {
  return SITE_SOURCE_LABELS[raw.toLowerCase()] ?? raw;
}

/** Groups a sessionId->label map into label counts, sorted descending —
 * shared by every breakdown below (device/browser/os/source/campaign/geo
 * all use the exact same "one label per session, count sessions per label"
 * shape). */
function bucketBy(map: Map<string, string>): { label: string; sessions: number }[] {
  const counts = new Map<string, number>();
  for (const v of map.values()) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([label, sessions]) => ({ label, sessions })).sort((a, b) => b.sessions - a.sessions);
}

/** Safe string read off a FunnelEvent.meta Json blob — meta is
 * client/server assembled ad hoc per event type (see track() call sites),
 * never schema-validated, so every read has to tolerate it being null,
 * an array, or missing the key entirely. */
function metaStr(meta: unknown, key: string): string | undefined {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const v = (meta as Record<string, unknown>)[key];
    if (typeof v === 'string') return v;
  }
  return undefined;
}

/** Real booking-funnel analytics off FunnelEvent — see that model's comment
 * for what's actually tracked (8 booking-flow steps plus a payment_failed
 * side-event, sessionId + optional eventId, device/browser/os parsed
 * server-side from the User-Agent, geography resolved server-side from the
 * request IP, and referrer/UTM/landing-page captured client-side at first
 * touch per session). Counts are *distinct sessions* that reached each
 * stage, not raw event fires — a reload doesn't inflate the numbers, same
 * as a real funnel tool. Revenue/promoter/ticket-tier numbers come from
 * real Booking rows in the same scope/date window, not from FunnelEvent —
 * that's the actual money, funnel events are just visibility into how
 * people got there. */
@Injectable()
export class AnalyticsReportService {
  constructor(private prisma: PrismaService) {}

  /** No EventStatus for "completed" — an event's end time is always derived
   * from date + durationHrs, same as Dashboard's `liveNow` calc, never a
   * stored flag. "Live" here means hasn't ended yet (covers both upcoming
   * and currently in progress); "past" means it has. */
  private hasEnded(e: { date: Date; durationHrs: number }, now: number): boolean {
    return e.date.getTime() + e.durationHrs * 3600000 < now;
  }

  /** City/organizer/eventScope filters go through Event (FunnelEvent has no
   * city/organizerId/date of its own) — resolves to the set of matching
   * event ids first, then filters FunnelEvent/Booking by that set alongside
   * any explicit eventId. A filter that matches zero events correctly
   * zeroes out the whole report rather than silently ignoring the filter. */
  private async resolveEventIds(city?: string, organizerId?: string, eventScope?: string): Promise<string[] | undefined> {
    if (!city && !organizerId && (!eventScope || eventScope === 'all')) return undefined;
    const events = await this.prisma.event.findMany({
      where: {
        ...(organizerId ? { organizerId } : {}),
        ...(city ? { OR: [{ privateCity: city }, { venue: { city } }] } : {}),
      },
      select: { id: true, date: true, durationHrs: true },
    });
    const now = Date.now();
    const scoped =
      !eventScope || eventScope === 'all'
        ? events
        : events.filter((e) => (eventScope === 'past' ? this.hasEnded(e, now) : !this.hasEnded(e, now)));
    return scoped.map((e) => e.id);
  }

  async get(params: {
    from?: string; to?: string; eventId?: string; city?: string; organizerId?: string;
    visitorState?: string; visitorCity?: string; eventScope?: string;
  }) {
    const scopedEventIds = await this.resolveEventIds(params.city, params.organizerId, params.eventScope);
    const dateWhere =
      params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: new Date(params.from) } : {}),
              ...(params.to ? { lte: new Date(params.to) } : {}),
            },
          }
        : {};
    // A specific eventId always wins outright rather than being merged with
    // scopedEventIds — both set the same `eventId` key, so spreading both
    // silently let scopedEventIds clobber a specific pick the moment it
    // stopped being conditional (eventScope defaults to 'live' now, so
    // scopedEventIds is defined on nearly every request). The Event
    // dropdown is already built from the same city/organizer/eventScope-
    // scoped list, so a specific pick from it needs no further narrowing.
    const eventScopeWhere = params.eventId ? { eventId: params.eventId } : scopedEventIds ? { eventId: { in: scopedEventIds } } : {};
    // Visitor state/city are FunnelEvent-only properties (Booking has no geo
    // of its own) — applied to the funnel query below directly, and to the
    // Booking query further down via a userId join (see visitorUserIds).
    // Both filters imply IN, same scoping as the region/city breakdowns and
    // dropdown lists below.
    const visitorGeoWhere = {
      ...(params.visitorState ? { geoRegion: params.visitorState, geoCountry: 'IN' } : {}),
      ...(params.visitorCity ? { geoCity: params.visitorCity, geoCountry: 'IN' } : {}),
    };

    const rows = await this.prisma.funnelEvent.findMany({
      where: { ...eventScopeWhere, ...dateWhere, ...visitorGeoWhere },
      select: {
        type: true, sessionId: true, eventId: true, createdAt: true, meta: true, userId: true,
        device: true, browser: true, os: true, referrerHost: true, utmSource: true, utmCampaign: true, siteSource: true,
        geoCountry: true, geoRegion: true, geoCity: true,
      },
    });
    // Booking has no geo of its own — when a visitor-geo filter is active,
    // narrow it to users who actually had a matching-geo funnel row (they're
    // only ever a Booking.userId while logged in, which every checkout/
    // completion event already requires). Less precise than a real per-
    // transaction geo would be, but real signal beats leaving revenue
    // completely unfiltered while every other number on the page *is*
    // scoped to the selected state/city — that inconsistency is confusing,
    // not honest.
    const visitorUserIds = params.visitorState || params.visitorCity
      ? [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))]
      : null;

    const stages = FUNNEL_TYPES.map((type) => ({
      type,
      sessions: new Set(rows.filter((r) => r.type === type).map((r) => r.sessionId)).size,
    }));

    // Device/browser/os/source/campaign/geo — one value per session (they
    // don't change mid-session by construction), last row for a session
    // wins but they're all consistent anyway so it never actually matters
    // which one is picked.
    const sessionDevice = new Map<string, string>();
    const sessionBrowser = new Map<string, string>();
    const sessionOs = new Map<string, string>();
    const sessionSource = new Map<string, string>();
    const sessionCampaign = new Map<string, string>();
    const sessionGeo = new Map<string, string>();
    const sessionRegion = new Map<string, string>();
    const sessionAdPlatform = new Map<string, string>();
    const sessionPromoter = new Map<string, string>();
    for (const r of rows) {
      if (r.device) sessionDevice.set(r.sessionId, r.device);
      if (r.browser) sessionBrowser.set(r.sessionId, r.browser);
      if (r.os) sessionOs.set(r.sessionId, r.os);
      if (!sessionSource.has(r.sessionId)) sessionSource.set(r.sessionId, trafficSourceOf(r.referrerHost, r.utmSource));
      if (r.utmCampaign && !sessionCampaign.has(r.sessionId)) sessionCampaign.set(r.sessionId, r.utmCampaign);
      // India-only, bare city name — same reasoning as the region/city
      // dropdown lists above (this platform is India-only for now, and a
      // country-suffixed/country-only label is dead weight nobody needs to
      // read here).
      if (r.geoCity && r.geoCountry === 'IN' && !sessionGeo.has(r.sessionId)) sessionGeo.set(r.sessionId, r.geoCity);
      if (r.geoRegion && r.geoCountry === 'IN' && !sessionRegion.has(r.sessionId)) sessionRegion.set(r.sessionId, indianStateName(r.geoRegion));
      if (r.siteSource && !sessionAdPlatform.has(r.sessionId)) sessionAdPlatform.set(r.sessionId, siteSourceLabel(r.siteSource));
      if (r.type === 'event_viewed' && !sessionPromoter.has(r.sessionId)) {
        const ref = metaStr(r.meta, 'promoterRef');
        if (ref) sessionPromoter.set(r.sessionId, ref);
      }
    }
    const devices = bucketBy(sessionDevice);
    const browsers = bucketBy(sessionBrowser);
    const operatingSystems = bucketBy(sessionOs);
    const trafficSources = bucketBy(sessionSource);
    const campaigns = bucketBy(sessionCampaign);
    const geographies = bucketBy(sessionGeo);
    const regions = bucketBy(sessionRegion);
    const adPlatforms = bucketBy(sessionAdPlatform);
    const viewsByPromoter = new Map<string, number>();
    for (const ref of sessionPromoter.values()) viewsByPromoter.set(ref, (viewsByPromoter.get(ref) ?? 0) + 1);

    // New vs returning — a session is "returning" if it was ever seen
    // (anywhere in history) before this report's own start date. With no
    // `from`, the range start is the epoch, so nothing can precede it and
    // everything is trivially "new" — same honest behavior as a real
    // analytics tool over an all-time window.
    const sessionIds = [...new Set(rows.map((r) => r.sessionId))];
    const firstTouches = sessionIds.length
      ? await this.prisma.funnelEvent.groupBy({ by: ['sessionId'], where: { sessionId: { in: sessionIds } }, _min: { createdAt: true } })
      : [];
    const rangeStart = params.from ? new Date(params.from) : new Date(0);
    let newCount = 0;
    let returningCount = 0;
    for (const f of firstTouches) {
      if (f._min.createdAt && f._min.createdAt < rangeStart) returningCount++;
      else newCount++;
    }
    const visitorType = [
      { label: 'new', sessions: newCount },
      { label: 'returning', sessions: returningCount },
    ].filter((b) => b.sessions > 0);

    // Hour-of-day x day-of-week heatmap — distinct viewing sessions, server
    // clock (same timezone every other timestamp in this report uses).
    const heatCounts = new Map<string, Set<string>>();
    for (const r of rows) {
      if (r.type !== 'event_viewed') continue;
      const key = `${r.createdAt.getUTCDay()}-${r.createdAt.getUTCHours()}`;
      const set = heatCounts.get(key) ?? new Set<string>();
      set.add(r.sessionId);
      heatCounts.set(key, set);
    }
    const heatmap = [...heatCounts.entries()].map(([key, sessionsSet]) => {
      const [weekday, hour] = key.split('-').map(Number);
      return { weekday, hour, sessions: sessionsSet.size };
    });

    // Payment failures — why checkout was abandoned, not just that it was.
    const failureReasons = new Map<string, number>();
    for (const r of rows) {
      if (r.type !== 'payment_failed') continue;
      const reason = metaStr(r.meta, 'reason') ?? 'unknown';
      failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
    }
    const paymentFailures = [...failureReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // Which real sale came from which ad/campaign — the booking_completed
    // row for a given sale carries both the real Booking.id (meta.bookingId,
    // see Checkout.tsx's afterBookingSuccess) and that same session's own
    // attribution fields, so no extra query or join table is needed: read
    // both off the one row. A confirmed booking with no matching row here
    // (a manual admin booking, or anything from before this field existed)
    // falls back to "Unattributed" below rather than being silently dropped
    // — same "don't let revenue go quietly inconsistent" reasoning as the
    // visitor-geo scoping above.
    const bookingCampaign = new Map<string, string>();
    const bookingAdPlatform = new Map<string, string>();
    for (const r of rows) {
      if (r.type !== 'booking_completed') continue;
      const bookingId = metaStr(r.meta, 'bookingId');
      if (!bookingId) continue;
      if (r.utmCampaign) bookingCampaign.set(bookingId, r.utmCampaign);
      if (r.siteSource) bookingAdPlatform.set(bookingId, siteSourceLabel(r.siteSource));
    }

    // Real money — Booking rows in the exact same scope/date window as the
    // funnel above (eventId/city/organizer + from/to + visitor geo via
    // userId, see visitorUserIds above), joined against Promoter and
    // TicketTier for display names.
    const bookings = await this.prisma.booking.findMany({
      where: { ...eventScopeWhere, ...dateWhere, ...(visitorUserIds ? { userId: { in: visitorUserIds } } : {}) },
      select: { id: true, total: true, status: true, createdAt: true, promoterRef: true, promoterCommission: true, tierBreakdown: true },
    });
    const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
    const totalRevenue = confirmedBookings.reduce((s, b) => s + b.total, 0);
    const refundedAmount = bookings.filter((b) => b.status === 'refunded').reduce((s, b) => s + b.total, 0);
    const bookingCount = confirmedBookings.length;
    const avgOrderValue = bookingCount ? Math.round(totalRevenue / bookingCount) : 0;

    const aggByLabel = (getLabel: (b: (typeof confirmedBookings)[number]) => string) => {
      const agg = new Map<string, { bookings: number; revenue: number }>();
      for (const b of confirmedBookings) {
        const label = getLabel(b);
        const cur = agg.get(label) ?? { bookings: 0, revenue: 0 };
        cur.bookings += 1;
        cur.revenue += b.total;
        agg.set(label, cur);
      }
      return [...agg.entries()]
        .map(([label, v]) => ({ label, bookings: v.bookings, revenue: v.revenue }))
        .sort((a, b) => b.revenue - a.revenue);
    };
    const revenueByAdPlatform = aggByLabel((b) => bookingAdPlatform.get(b.id) ?? 'Unattributed');
    const revenueByCampaign = aggByLabel((b) => bookingCampaign.get(b.id) ?? 'Unattributed');

    const promoterAgg = new Map<string, { bookings: number; revenue: number; commission: number }>();
    for (const b of confirmedBookings) {
      if (!b.promoterRef) continue;
      const agg = promoterAgg.get(b.promoterRef) ?? { bookings: 0, revenue: 0, commission: 0 };
      agg.bookings += 1;
      agg.revenue += b.total;
      agg.commission += b.promoterCommission;
      promoterAgg.set(b.promoterRef, agg);
    }
    const allPromoterRefs = [...new Set([...promoterAgg.keys(), ...viewsByPromoter.keys()])];
    const attributedPromoters = allPromoterRefs.length
      ? await this.prisma.promoter.findMany({ where: { slug: { in: allPromoterRefs } }, select: { slug: true, name: true } })
      : [];
    const promoterNameBySlug = new Map(attributedPromoters.map((p) => [p.slug, p.name]));
    const promoterAttribution = allPromoterRefs
      .map((ref) => ({
        promoterRef: ref,
        promoterName: promoterNameBySlug.get(ref) ?? ref,
        views: viewsByPromoter.get(ref) ?? 0,
        bookings: promoterAgg.get(ref)?.bookings ?? 0,
        revenue: promoterAgg.get(ref)?.revenue ?? 0,
        commission: promoterAgg.get(ref)?.commission ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const tierQty = new Map<string, number>();
    for (const b of confirmedBookings) {
      const breakdown = (b.tierBreakdown ?? {}) as Record<string, number>;
      for (const [tierId, qty] of Object.entries(breakdown)) {
        tierQty.set(tierId, (tierQty.get(tierId) ?? 0) + (Number(qty) || 0));
      }
    }
    const tierIds = [...tierQty.keys()];
    const tiers = tierIds.length
      ? await this.prisma.ticketTier.findMany({ where: { id: { in: tierIds } }, select: { id: true, name: true, price: true } })
      : [];
    const ticketTierSales = tiers
      .map((t) => ({ tierId: t.id, tierName: t.name, qty: tierQty.get(t.id) ?? 0, revenue: (tierQty.get(t.id) ?? 0) * t.price }))
      .sort((a, b) => b.revenue - a.revenue);

    // Daily trend — distinct sessions per day for the funnel's top (viewed)
    // and bottom (completed) stages, plus real confirmed-booking revenue
    // for that same day, the numbers that actually matter for a trend
    // line: traffic in, conversions out, money made.
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const dailyMap = new Map<string, { viewed: Set<string>; completed: Set<string>; revenue: number }>();
    for (const r of rows) {
      if (r.type !== 'event_viewed' && r.type !== 'booking_completed') continue;
      const key = dayKey(r.createdAt);
      const bucket = dailyMap.get(key) ?? { viewed: new Set<string>(), completed: new Set<string>(), revenue: 0 };
      (r.type === 'event_viewed' ? bucket.viewed : bucket.completed).add(r.sessionId);
      dailyMap.set(key, bucket);
    }
    for (const b of confirmedBookings) {
      const key = dayKey(b.createdAt);
      const bucket = dailyMap.get(key) ?? { viewed: new Set<string>(), completed: new Set<string>(), revenue: 0 };
      bucket.revenue += b.total;
      dailyMap.set(key, bucket);
    }
    const daily = [...dailyMap.entries()]
      .map(([date, b]) => ({ date, viewed: b.viewed.size, completed: b.completed.size, revenue: b.revenue }))
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
      select: { id: true, title: true, organizer: { select: { brandName: true } }, venue: { select: { name: true } }, hostedByVenue: true },
    });
    const titleById = new Map(eventTitles.map((e) => [e.id, e]));
    const topEvents = topEventIds.map(([id, b]) => ({
      eventId: id,
      title: titleById.get(id)?.title ?? id,
      // Solo venue-hosted event (no organizer) — show the venue's own name
      // instead of an organizer brand that doesn't exist for this event.
      organizerBrand: titleById.get(id)?.organizer?.brandName ?? titleById.get(id)?.venue?.name ?? '',
      viewed: b.viewed.size,
      completed: b.completed.size,
      conversionPct: b.viewed.size ? Math.round((b.completed.size / b.viewed.size) * 100) : 0,
    }));

    return {
      stages, totalEvents: rows.length, daily, topEvents,
      devices, browsers, operatingSystems, trafficSources,
      campaigns, geographies, regions, adPlatforms, visitorType, heatmap, paymentFailures,
      revenue: { totalRevenue, refundedAmount, bookingCount, avgOrderValue },
      promoterAttribution, ticketTierSales,
      revenueByAdPlatform, revenueByCampaign,
    };
  }

  /** "Right now" — distinct sessions with any funnel activity in the last 5
   * minutes, same live-traffic idea as a real analytics tool's realtime
   * view. Kept to stage counts only (no device/source breakdown here) since
   * a 5-minute window rarely has enough sessions for a breakdown to mean
   * anything — that's what get()'s wider date range is for. Poll this on
   * an interval from the frontend; it's not a push/websocket feed. */
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
   * selected without another round trip. `eventScope` narrows the *events*
   * list only (live/past/all) — City/Organizer stay unfiltered, they're
   * stable metadata, not "past data" in the sense that prompted this. */
  async filters(eventScope?: string) {
    const allEvents = await this.prisma.event.findMany({
      select: { id: true, title: true, organizerId: true, privateCity: true, date: true, durationHrs: true, venue: { select: { city: true } } },
      orderBy: { date: 'desc' },
    });
    const now = Date.now();
    const events =
      !eventScope || eventScope === 'all'
        ? allEvents
        : allEvents.filter((e) => (eventScope === 'past' ? this.hasEnded(e, now) : !this.hasEnded(e, now)));
    const organizers = await this.prisma.organizer.findMany({ select: { id: true, brandName: true }, orderBy: { brandName: 'asc' } });
    const cities = [...new Set(allEvents.map((e) => e.privateCity ?? e.venue?.city).filter((c): c is string => !!c))].sort();
    // Visitor states/cities (FunnelEvent.geoRegion/geoCity) — distinct from
    // `cities` above, which is where *events* are hosted, not where visitors
    // are browsing from. India-only, same reasoning as the regions/geo
    // breakdowns above (unambiguous state codes, keeps the list to what's
    // actually relevant rather than every bot/VPN country that's ever hit
    // the site).
    const regionRows = await this.prisma.funnelEvent.findMany({
      where: { geoRegion: { not: null }, geoCountry: 'IN' },
      select: { geoRegion: true },
      distinct: ['geoRegion'],
    });
    const visitorStates = regionRows
      .map((r) => ({ code: r.geoRegion as string, name: indianStateName(r.geoRegion as string) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const cityRows = await this.prisma.funnelEvent.findMany({
      where: { geoCity: { not: null }, geoCountry: 'IN' },
      select: { geoCity: true },
      distinct: ['geoCity'],
    });
    const visitorCities = cityRows.map((r) => r.geoCity as string).sort();
    return {
      organizers,
      cities,
      visitorStates,
      visitorCities,
      events: events.map((e) => ({ id: e.id, title: e.title, organizerId: e.organizerId, city: e.privateCity ?? e.venue?.city ?? null })),
    };
  }
}
