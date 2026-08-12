import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  liveAnalytics, FUNNEL_STAGES, LiveApiError,
  type FunnelStageCount, type AnalyticsBucket, type AnalyticsFilters, type AnalyticsRealtime, type LiveAnalytics,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { LineChart, DonutChart } from '../components/ui';
import SearchableSelect from '../components/SearchableSelect';

const TITLE = 'Analytics';
const PALETTE = ['#9be13d', '#5b8def', '#e8a13d', '#e05d5d', '#a06ee1', '#3dc9c9', '#e14fa0'];
const colored = (buckets: AnalyticsBucket[]) => buckets.map((b, i) => ({ label: b.label, value: b.sessions, color: PALETTE[i % PALETTE.length] }));
const REALTIME_POLL_MS = 15000;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  return toDateInput(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

const TODAY = () => toDateInput(new Date());
const RANGE_PRESETS: Record<string, () => { from: string; to: string }> = {
  Today: () => ({ from: TODAY(), to: TODAY() }),
  Yesterday: () => ({ from: daysAgo(1), to: daysAgo(1) }),
  'Last 7 days': () => ({ from: daysAgo(6), to: TODAY() }),
  'Last 14 days': () => ({ from: daysAgo(13), to: TODAY() }),
  'Last 30 days': () => ({ from: daysAgo(29), to: TODAY() }),
  'This month': () => {
    const now = new Date();
    return { from: toDateInput(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), to: TODAY() };
  },
  'Last month': () => {
    const now = new Date();
    const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
    const firstOfPrevMonth = new Date(Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1));
    return { from: toDateInput(firstOfPrevMonth), to: toDateInput(lastOfPrevMonth) };
  },
};

function csvCell(v: string | number) {
  return typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, blocks: { header: string[]; rows: (string | number)[][] }[]) {
  const text = blocks
    .map((b) => [b.header.map(csvCell).join(','), ...b.rows.map((r) => r.map(csvCell).join(','))].join('\n'))
    .join('\n\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

/** Real booking-funnel analytics (GET /admin/analytics + /realtime +
 * /filters) — event/city/organizer filters, a daily viewed-vs-completed
 * trend, a top-events ranking, and a "right now" panel (distinct sessions
 * active in the last 5 minutes, polled — not a push feed). Built entirely
 * off FunnelEvent, the only thing actually tracked; deliberately doesn't
 * show device/browser/referrer breakdowns since nothing here collects
 * those, unlike a full Google-Analytics-style property. */
export default function Analytics() {
  const session = useLiveSession();
  const { token } = session;

  const [from, setFrom] = useState(() => daysAgo(6));
  const [to, setTo] = useState(TODAY);
  const [rangePreset, setRangePreset] = useState('Last 7 days');
  const [organizerId, setOrganizerId] = useState('');
  const [city, setCity] = useState('');
  const [eventId, setEventId] = useState('');
  const [visitorState, setVisitorState] = useState('');
  const [visitorCity, setVisitorCity] = useState('');

  const [filters, setFilters] = useState<AnalyticsFilters | null>(null);
  const [report, setReport] = useState<LiveAnalytics | null>(null);
  const [realtime, setRealtime] = useState<AnalyticsRealtime | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    liveAnalytics.filters().then(setFilters).catch(() => {});
  }, [token]);

  // Accepts explicit from/to so a preset click can load immediately with
  // the just-computed dates instead of reading stale pre-update state
  // (setFrom/setTo followed by an immediate load() in the same handler
  // would otherwise still see the old values, React state updates being
  // async).
  const load = (overrides?: { from?: string; to?: string }) => {
    const effectiveFrom = overrides?.from ?? from;
    const effectiveTo = overrides?.to ?? to;
    setLoading(true);
    setErr('');
    liveAnalytics
      .get({
        from: effectiveFrom,
        // Explicit Z — a bare "T23:59:59" has no timezone, so JS parses it
        // as the *server's* local time; an unambiguous UTC boundary is
        // required either way.
        to: effectiveTo ? `${effectiveTo}T23:59:59Z` : undefined,
        eventId: eventId || undefined,
        city: city || undefined,
        organizerId: organizerId || undefined,
        visitorState: visitorState || undefined,
        visitorCity: visitorCity || undefined,
      })
      .then(setReport)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  // A preset click both fills the From/To fields and loads immediately —
  // manually editing From/To directly still requires clicking Refresh, same
  // as every other filter on this page.
  const applyPreset = (label: string) => {
    setRangePreset(label);
    const preset = RANGE_PRESETS[label];
    if (!preset) return;
    const { from: f, to: t } = preset();
    setFrom(f);
    setTo(t);
    if (token) load({ from: f, to: t });
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Realtime — polled, not pushed.
  useEffect(() => {
    if (!token) return;
    const tick = () => liveAnalytics.realtime().then(setRealtime).catch(() => {});
    tick();
    const t = setInterval(tick, REALTIME_POLL_MS);
    return () => clearInterval(t);
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const exportCsv = () => {
    if (!report) return;
    downloadCsv(`prebooze-analytics-${from}-to-${to}.csv`, [
      { header: ['Metric', 'Value'], rows: [
        ['Total revenue (₹)', report.revenue.totalRevenue],
        ['Refunded (₹)', report.revenue.refundedAmount],
        ['Confirmed bookings', report.revenue.bookingCount],
        ['Avg order value (₹)', report.revenue.avgOrderValue],
      ] },
      { header: ['Funnel stage', 'Sessions'], rows: report.stages.map((s) => [FUNNEL_STAGES.find((f) => f.type === s.type)?.label ?? s.type, s.sessions]) },
      { header: ['Date', 'Viewed', 'Completed', 'Revenue (₹)'], rows: report.daily.map((d) => [d.date, d.viewed, d.completed, d.revenue]) },
      { header: ['Event', 'Organizer', 'Viewed', 'Booked', 'Conversion %'], rows: report.topEvents.map((e) => [e.title, e.organizerBrand, e.viewed, e.completed, e.conversionPct]) },
      { header: ['Promoter', 'Views', 'Bookings', 'Revenue (₹)', 'Commission (₹)'], rows: report.promoterAttribution.map((p) => [p.promoterName, p.views, p.bookings, p.revenue, p.commission]) },
      { header: ['Ticket tier', 'Qty sold', 'Revenue (₹)'], rows: report.ticketTierSales.map((t) => [t.tierName, t.qty, t.revenue]) },
      { header: ['Payment failure reason', 'Count'], rows: report.paymentFailures.map((f) => [f.reason, f.count]) },
      { header: ['Visitor state', 'Sessions'], rows: report.regions.map((r) => [r.label, r.sessions]) },
      { header: ['Ad platform', 'Sessions'], rows: report.adPlatforms.map((a) => [a.label, a.sessions]) },
    ]);
  };

  // Cascading: narrow the event dropdown to whatever organizer/city is
  // already picked, so it never offers a combination that'd just return
  // zero rows.
  const eventOptions = useMemo(() => {
    if (!filters) return [];
    return filters.events.filter((e) => (!organizerId || e.organizerId === organizerId) && (!city || e.city === city));
  }, [filters, organizerId, city]);

  const countFor = (stages: FunnelStageCount[], type: string) => stages.find((s) => s.type === type)?.sessions ?? 0;
  const stages = report?.stages ?? [];
  const first = countFor(stages, FUNNEL_STAGES[0].type);
  let prevCount = 0;

  return (
    <div className="stack fade" style={{ maxWidth: 980 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="page-hd">
        <h1 className="page-title">Analytics</h1>
      </div>
      <p className="tiny hint" style={{ marginTop: -6 }}>
        Real booking-funnel data — distinct browser sessions that reached each step, not raw event fires. Device/
        browser/OS/city are parsed server-side from each request; traffic source and campaign come from the referrer
        and UTM params captured at first touch. Revenue, promoter attribution, and ticket-tier sales are real
        confirmed Booking rows, not funnel estimates. Still no ad-spend integration — just what's actually tracked
        here.
      </p>

      <div className="card" style={{ borderColor: 'var(--green)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="display" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            Right now
          </span>
          <span className="tiny muted">last 5 min · refreshes every 15s</span>
        </div>
        <div className="kpi-grid" style={{ marginBottom: realtime && realtime.recent.length > 0 ? 10 : 0 }}>
          <div className="kpi"><div className="l">Active sessions</div><div className="v">{realtime?.activeSessions ?? '—'}</div></div>
          {FUNNEL_STAGES.filter((s) => ['event_viewed', 'checkout_viewed', 'booking_completed'].includes(s.type)).map((s) => (
            <div className="kpi" key={s.type}>
              <div className="l">{s.label}</div>
              <div className="v">{realtime ? countFor(realtime.byType, s.type) : '—'}</div>
            </div>
          ))}
        </div>
        {realtime && realtime.recent.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
            {realtime.recent.map((r, i) => (
              <div key={i} className="tiny muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{FUNNEL_STAGES.find((s) => s.type === r.type)?.label ?? r.type}{r.eventTitle ? ` · ${r.eventTitle}` : ''}</span>
                <span>{new Date(r.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 160 }}>
          <label>Range</label>
          <select className="input" value={rangePreset} onChange={(e) => applyPreset(e.target.value)}>
            <option value="" disabled>Custom range</option>
            {Object.keys(RANGE_PRESETS).map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 160 }}>
          <label>From</label>
          <input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setRangePreset(''); }} />
        </div>
        <div className="field" style={{ maxWidth: 160 }}>
          <label>To</label>
          <input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setRangePreset(''); }} />
        </div>
        <div className="field" style={{ maxWidth: 200 }}>
          <label>City</label>
          <select className="input" value={city} onChange={(e) => { setCity(e.target.value); setEventId(''); }}>
            <option value="">All cities</option>
            {filters?.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 220 }}>
          <label>Organizer</label>
          <select className="input" value={organizerId} onChange={(e) => { setOrganizerId(e.target.value); setEventId(''); }}>
            <option value="">All organizers</option>
            {filters?.organizers.map((o) => <option key={o.id} value={o.id}>{o.brandName}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 240 }}>
          <label>Event</label>
          <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">All events</option>
            {eventOptions.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 200 }}>
          <label>Visitor state</label>
          <SearchableSelect
            value={visitorState}
            onChange={setVisitorState}
            options={(filters?.visitorStates ?? []).map((s) => ({ value: s.code, label: s.name }))}
            placeholder="All states"
            allLabel="All states"
          />
        </div>
        <div className="field" style={{ maxWidth: 200 }}>
          <label>Visitor city</label>
          <SearchableSelect
            value={visitorCity}
            onChange={setVisitorCity}
            options={(filters?.visitorCities ?? []).map((c) => ({ value: c, label: c }))}
            placeholder="All cities"
            allLabel="All cities"
          />
        </div>
        <button className="btn btn-pri btn-sm" onClick={() => load()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        <button className="btn btn-sm" onClick={exportCsv} disabled={!report}>Export CSV</button>
      </div>

      {report && (
        <div className="kpi-grid">
          <div className="kpi"><div className="l">Revenue</div><div className="v">{inr(report.revenue.totalRevenue)}</div></div>
          <div className="kpi"><div className="l">Confirmed bookings</div><div className="v">{report.revenue.bookingCount.toLocaleString('en-IN')}</div></div>
          <div className="kpi"><div className="l">Avg order value</div><div className="v">{inr(report.revenue.avgOrderValue)}</div></div>
          <div className="kpi"><div className="l">Refunded</div><div className="v">{inr(report.revenue.refundedAmount)}</div></div>
        </div>
      )}

      {report && report.daily.length > 1 && (
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Traffic vs conversions</div>
          <LineChart
            height={140}
            labels={[report.daily[0].date, report.daily[report.daily.length - 1].date]}
            series={[
              { label: 'Viewed', color: 'var(--green)', points: report.daily.map((d) => d.viewed) },
              { label: 'Booking completed', color: '#5b8def', points: report.daily.map((d) => d.completed) },
            ]}
          />
        </div>
      )}

      {report && report.daily.length > 1 && report.revenue.totalRevenue > 0 && (
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Revenue trend</div>
          <LineChart
            height={140}
            labels={[report.daily[0].date, report.daily[report.daily.length - 1].date]}
            series={[{ label: 'Revenue (₹)', color: '#e8a13d', points: report.daily.map((d) => d.revenue) }]}
          />
        </div>
      )}

      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Funnel — this range</div>
        {FUNNEL_STAGES.map((stage, i) => {
          const count = countFor(stages, stage.type);
          const ofFirst = first ? Math.round((count / first) * 100) : 0;
          const ofPrev = i === 0 ? null : prevCount ? Math.round((count / prevCount) * 100) : 0;
          const barPct = first ? Math.max(2, Math.round((count / first) * 100)) : 0;
          prevCount = count;
          return (
            <div key={stage.type} style={{ padding: '10px 0', borderBottom: i < FUNNEL_STAGES.length - 1 ? '1px solid var(--border-soft)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span className="small bold">{stage.label}</span>
                <span className="small">
                  <b>{count.toLocaleString('en-IN')}</b>
                  <span className="tiny muted" style={{ marginLeft: 8 }}>
                    {ofFirst}% of viewed{ofPrev !== null && ` · ${ofPrev}% of previous step`}
                  </span>
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--border-soft)', overflow: 'hidden' }}>
                <div style={{ width: `${barPct}%`, height: '100%', background: 'var(--green)' }} />
              </div>
            </div>
          );
        })}
        {!loading && first === 0 && (
          <div className="tiny muted" style={{ padding: '10px 0' }}>No activity in this range yet.</div>
        )}
      </div>

      {report && (report.devices.length > 0 || report.browsers.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Device</div>
            <DonutChart data={colored(report.devices)} />
          </div>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Browser</div>
            <DonutChart data={colored(report.browsers)} />
          </div>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>OS</div>
            <DonutChart data={colored(report.operatingSystems)} />
          </div>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Traffic source</div>
            <DonutChart data={colored(report.trafficSources)} />
          </div>
        </div>
      )}

      {report && (report.visitorType.length > 0 || report.campaigns.length > 0 || report.geographies.length > 0 || report.regions.length > 0 || report.adPlatforms.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {report.visitorType.length > 0 && (
            <div className="card">
              <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>New vs returning</div>
              <DonutChart data={colored(report.visitorType)} />
            </div>
          )}
          {report.campaigns.length > 0 && (
            <div className="card">
              <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Campaign (utm_campaign)</div>
              <DonutChart data={colored(report.campaigns)} />
            </div>
          )}
          {report.adPlatforms.length > 0 && (
            <div className="card">
              <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Ad platform (Facebook vs Instagram)</div>
              <DonutChart data={colored(report.adPlatforms)} />
            </div>
          )}
          {report.geographies.length > 0 && (
            <div className="card">
              <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Visitor city</div>
              <DonutChart data={colored(report.geographies)} />
            </div>
          )}
          {report.regions.length > 0 && (
            <div className="card">
              <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Visitor state</div>
              <DonutChart data={colored(report.regions)} />
            </div>
          )}
        </div>
      )}

      {report && report.heatmap.length > 0 && (
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>When people browse</div>
          <p className="tiny muted" style={{ marginBottom: 10 }}>Distinct viewing sessions by hour and day of week (server time / UTC).</p>
          <div className="tblwrap">
            <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2, minWidth: 620 }}>
              <span />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="tiny muted" style={{ textAlign: 'center' }}>{h}</span>
              ))}
              {WEEKDAY_LABELS.map((label, weekday) => {
                const heatMax = Math.max(1, ...report.heatmap.map((c) => c.sessions));
                return (
                  <Fragment key={weekday}>
                    <span className="tiny muted" style={{ display: 'flex', alignItems: 'center' }}>{label}</span>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = report.heatmap.find((c) => c.weekday === weekday && c.hour === hour);
                      const alpha = cell ? 0.12 + (cell.sessions / heatMax) * 0.88 : 0;
                      return (
                        <div
                          key={`${weekday}-${hour}`}
                          title={cell ? `${label} ${hour}:00 — ${cell.sessions} session${cell.sessions === 1 ? '' : 's'}` : undefined}
                          style={{ height: 16, borderRadius: 3, background: cell ? `rgba(155,225,61,${alpha})` : 'var(--border-soft)' }}
                        />
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {report && report.topEvents.length > 0 && (
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Top events by views</div>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 600 }}>
              <span style={{ flex: 1.8 }}>Event</span>
              <span style={{ flex: 1.2 }}>Organizer</span>
              <span style={{ flex: 0.9 }}>Viewed</span>
              <span style={{ flex: 0.9 }}>Booked</span>
              <span style={{ flex: 0.9 }}>Conversion</span>
            </div>
            {report.topEvents.map((e) => (
              <div key={e.eventId} className="trow" style={{ minWidth: 600 }}>
                <span style={{ flex: 1.8, fontWeight: 700 }}>{e.title}</span>
                <span style={{ flex: 1.2 }} className="muted">{e.organizerBrand}</span>
                <span style={{ flex: 0.9 }}>{e.viewed.toLocaleString('en-IN')}</span>
                <span style={{ flex: 0.9 }}>{e.completed.toLocaleString('en-IN')}</span>
                <span style={{ flex: 0.9 }} className={e.conversionPct >= 10 ? 'green' : ''}>{e.conversionPct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report && report.promoterAttribution.length > 0 && (
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Promoter attribution</div>
          <p className="tiny muted" style={{ marginBottom: 10 }}>Views credited to a promoter's link, and the real revenue/commission their sales generated in this range.</p>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 560 }}>
              <span style={{ flex: 1.6 }}>Promoter</span>
              <span style={{ flex: 0.8 }}>Views</span>
              <span style={{ flex: 0.8 }}>Bookings</span>
              <span style={{ flex: 1 }}>Revenue</span>
              <span style={{ flex: 1 }}>Commission</span>
            </div>
            {report.promoterAttribution.map((p) => (
              <div key={p.promoterRef} className="trow" style={{ minWidth: 560 }}>
                <span style={{ flex: 1.6, fontWeight: 700 }}>{p.promoterName}</span>
                <span style={{ flex: 0.8 }}>{p.views.toLocaleString('en-IN')}</span>
                <span style={{ flex: 0.8 }}>{p.bookings.toLocaleString('en-IN')}</span>
                <span style={{ flex: 1 }}>{inr(p.revenue)}</span>
                <span style={{ flex: 1 }} className="muted">{inr(p.commission)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report && report.ticketTierSales.length > 0 && (
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Sales by ticket tier</div>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 420 }}>
              <span style={{ flex: 1.6 }}>Tier</span>
              <span style={{ flex: 0.8 }}>Qty sold</span>
              <span style={{ flex: 1 }}>Revenue</span>
            </div>
            {report.ticketTierSales.map((t) => (
              <div key={t.tierId} className="trow" style={{ minWidth: 420 }}>
                <span style={{ flex: 1.6, fontWeight: 700 }}>{t.tierName}</span>
                <span style={{ flex: 0.8 }}>{t.qty.toLocaleString('en-IN')}</span>
                <span style={{ flex: 1 }}>{inr(t.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report && report.paymentFailures.length > 0 && (
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Payment failures</div>
          <p className="tiny muted" style={{ marginBottom: 10 }}>Why the payment widget didn't convert — not just that it didn't.</p>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 320 }}>
              <span style={{ flex: 2 }}>Reason</span>
              <span style={{ flex: 1 }}>Count</span>
            </div>
            {report.paymentFailures.map((f) => (
              <div key={f.reason} className="trow" style={{ minWidth: 320 }}>
                <span style={{ flex: 2 }}>{f.reason}</span>
                <span style={{ flex: 1 }}>{f.count.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
