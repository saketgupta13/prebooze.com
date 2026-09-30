import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, Users, MousePointerClick, Percent } from 'lucide-react';
import { organizer } from '../../api';
import { ApiError } from '../../api/client';
import type { MarketingAnalytics as MarketingAnalyticsData, MarketingPeriodAnalytics } from '../../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const STAGE_LABEL: Record<string, string> = {
  event_viewed: 'Viewed event', book_clicked: 'Clicked book', otp_requested: 'Requested OTP', otp_verified: 'Verified OTP',
  checkout_viewed: 'Reached checkout', payment_widget_opened: 'Opened payment', payment_submitted: 'Submitted payment', booking_completed: 'Booked',
};

function RankedList({ title, rows }: { title: string; rows: { label: string; sessions: number }[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.sessions));
  return (
    <div className="card">
      <h4 style={{ marginBottom: 8 }}>{title}</h4>
      <div className="stack" style={{ gap: 6 }}>
        {rows.slice(0, 8).map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: '0 0 120px', fontSize: 13 }}>{r.label}</span>
            <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(r.sessions / max) * 100}%`, background: 'var(--accent)', height: '100%' }} />
            </div>
            <span className="tiny muted" style={{ flex: '0 0 30px', textAlign: 'right' }}>{r.sessions}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Real on-site funnel performance for ONE event — unlocked only once that
 * event has an active/completed MarketingOrder (or falls inside an active
 * MarketingSubscription's current period), enforced server-side by
 * MarketingService.analyticsFor. Deliberately shows no revenue, commission,
 * or ad-spend figures — just views/carts/bookings and where the traffic
 * came from, same funnel data admin's own Analytics page is built on, just
 * scoped to this one event and this organizer. */
export default function MarketingAnalytics() {
  const [params] = useSearchParams();
  const eventId = params.get('eventId') ?? '';
  const orderId = params.get('orderId') ?? '';
  const [data, setData] = useState<MarketingAnalyticsData | MarketingPeriodAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!eventId && !orderId) {
      setLoading(false);
      setErr('No event selected');
      return;
    }
    const req = orderId ? organizer.marketing.analyticsPeriod(orderId) : organizer.marketing.analytics(eventId);
    req
      .then(setData)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) setLocked(true);
        else setErr(e instanceof ApiError ? e.message : 'Failed to load analytics');
      })
      .finally(() => setLoading(false));
  }, [eventId, orderId]);

  if (loading) return <div className="stack fade"><p className="muted">Loading…</p></div>;

  if (locked) {
    return (
      <div className="stack fade" style={{ maxWidth: 640, gap: 14 }}>
        <Link to="/organizer/marketing" className="link tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={14} /> Back to Marketing</Link>
        <div className="card">
          <h3>No active marketing campaign for this event</h3>
          <p className="muted small" style={{ marginTop: 6 }}>
            Performance analytics unlock once you've paid for a dedicated ad campaign on this event — pay per event, or
            have an active 30-day subscription running while it's on sale.
          </p>
          <Link to="/organizer/marketing" className="btn btn-pri btn-sm" style={{ marginTop: 10, display: 'inline-block' }}>Set up marketing →</Link>
        </div>
      </div>
    );
  }

  if (err || !data) return <div className="stack fade"><div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'No data'}</div></div>;

  const isPeriod = 'events' in data;

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 16 }}>
      <Link to="/organizer/marketing" className="link tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={14} /> Back to Marketing</Link>
      <div className="page-hd">
        <h1 className="page-title">{isPeriod ? '30-day plan performance' : 'Event performance'}</h1>
      </div>

      {isPeriod && (
        <div className="card">
          <h4 style={{ marginBottom: 8 }}>Events covered this period</h4>
          {data.events.length === 0 ? (
            <p className="muted small">No events scheduled in this window yet.</p>
          ) : (
            <div className="stack" style={{ gap: 4 }}>
              {data.events.map((e) => <div key={e.id} className="tiny">{e.title}</div>)}
            </div>
          )}
        </div>
      )}

      {data.adPerformance && (
        <div className="card">
          <h4 style={{ marginBottom: 8 }}>Real ad performance</h4>
          <p className="tiny muted" style={{ marginBottom: 10 }}>Straight from Meta — how the actual ad campaign is doing.</p>
          <div className="kpi-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={14} className="muted" /> <span className="bold">{data.adPerformance.impressions.toLocaleString('en-IN')}</span> <span className="tiny muted">impressions</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} className="muted" /> <span className="bold">{data.adPerformance.reach.toLocaleString('en-IN')}</span> <span className="tiny muted">people reached</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MousePointerClick size={14} className="muted" /> <span className="bold">{data.adPerformance.clicks.toLocaleString('en-IN')}</span> <span className="tiny muted">clicks</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Percent size={14} className="muted" /> <span className="bold">{data.adPerformance.ctr}%</span> <span className="tiny muted">CTR</span></div>
          </div>
        </div>
      )}

      <div className="card">
        <h4 style={{ marginBottom: 8 }}>Funnel</h4>
        <div className="stack" style={{ gap: 6 }}>
          {data.stages.map((s, i) => {
            const prev = i > 0 ? data.stages[i - 1].sessions : s.sessions;
            const pct = prev ? Math.round((s.sessions / prev) * 100) : 100;
            return (
              <div key={s.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{STAGE_LABEL[s.type] ?? s.type}</span>
                <span className="muted">{s.sessions} {i > 0 && <span className="tiny">({pct}%)</span>}</span>
              </div>
            );
          })}
        </div>
      </div>

      {data.daily.length > 0 && (
        <div className="card">
          <h4 style={{ marginBottom: 8 }}>Daily trend</h4>
          <div className="stack" style={{ gap: 4 }}>
            {data.daily.map((d) => (
              <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="muted">{fmtDate(d.date)}</span>
                <span>{d.viewed} viewed · {d.completed} booked</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RankedList title="Traffic sources" rows={data.trafficSources} />
      <RankedList title="Ad platforms" rows={data.adPlatforms} />
      <RankedList title="Campaigns" rows={data.campaigns} />
      <RankedList title="Devices" rows={data.devices} />
      <RankedList title="Cities" rows={data.geographies} />
      <RankedList title="New vs returning" rows={data.visitorType} />

      {data.paymentFailures.length > 0 && (
        <div className="card">
          <h4 style={{ marginBottom: 8 }}>Payment drop-offs</h4>
          <div className="stack" style={{ gap: 4 }}>
            {data.paymentFailures.map((f) => (
              <div key={f.reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="muted">{f.reason}</span>
                <span>{f.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
