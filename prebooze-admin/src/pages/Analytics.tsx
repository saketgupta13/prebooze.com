import { useEffect, useMemo, useState } from 'react';
import {
  liveAnalytics, FUNNEL_STAGES, LiveApiError,
  type FunnelStageCount, type AnalyticsBucket, type AnalyticsFilters, type AnalyticsRealtime, type LiveAnalytics,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { LineChart, DonutChart } from '../components/ui';

const TITLE = 'Analytics';
const PALETTE = ['#9be13d', '#5b8def', '#e8a13d', '#e05d5d', '#a06ee1', '#3dc9c9', '#e14fa0'];
const colored = (buckets: AnalyticsBucket[]) => buckets.map((b, i) => ({ label: b.label, value: b.sessions, color: PALETTE[i % PALETTE.length] }));
const REALTIME_POLL_MS = 15000;

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
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

  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [organizerId, setOrganizerId] = useState('');
  const [city, setCity] = useState('');
  const [eventId, setEventId] = useState('');

  const [filters, setFilters] = useState<AnalyticsFilters | null>(null);
  const [report, setReport] = useState<LiveAnalytics | null>(null);
  const [realtime, setRealtime] = useState<AnalyticsRealtime | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    liveAnalytics.filters().then(setFilters).catch(() => {});
  }, [token]);

  const load = () => {
    setLoading(true);
    setErr('');
    liveAnalytics
      .get({
        from,
        // Explicit Z — a bare "T23:59:59" has no timezone, so JS parses it
        // as the *server's* local time; an unambiguous UTC boundary is
        // required either way.
        to: to ? `${to}T23:59:59Z` : undefined,
        eventId: eventId || undefined,
        city: city || undefined,
        organizerId: organizerId || undefined,
      })
      .then(setReport)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
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
        browser/OS are parsed server-side from each request; traffic source comes from the referrer and UTM params
        captured at first touch. Still no ad-spend/conversion-value integration or logged-in-vs-anonymous split —
        just what's actually tracked here.
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
          <label>From</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ maxWidth: 160 }}>
          <label>To</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
        <button className="btn btn-pri btn-sm" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

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
    </div>
  );
}
