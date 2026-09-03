import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../../components/Loader';
import { venuePartner, type OrgAttendee, type VenueLedgerTx } from '../../api';
import { ApiError } from '../../api/client';
import type { Event } from '../../types';
import VenueHosting from './VenueHosting';

const fmtMoney = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const DAY_MS = 86400000;

/** Real venue-hosting dashboard — same stats an organizer sees on their own
 * Dashboard.tsx (same KPIs, same top-selling/ticket-stats/bookings-over-time/
 * upcoming-events cards), just off venuePartner.* instead of organizer.* and
 * scoped to this venue's own hosted events. Only rendered once hostingEnabled
 * — before that there's no real hosting data to show a dashboard of, so this
 * skips straight to VenueHosting's request/status flow. Either way,
 * VenueHosting (the hosting guide + status card) renders below as "current
 * details", not replaced by this. */
export default function VenueOrgDashboard() {
  const [hostingEnabled, setHostingEnabled] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [transactions, setTransactions] = useState<VenueLedgerTx[]>([]);
  const [attendees, setAttendees] = useState<OrgAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    venuePartner
      .hostingStatus()
      .then(async (s) => {
        setHostingEnabled(s.hostingEnabled);
        if (!s.hostingEnabled) return;
        const [evs, ledger] = await Promise.all([
          venuePartner.hostedEvents().catch(() => [] as Event[]),
          venuePartner.myLedger().catch(() => ({ balance: 0, transactions: [] as VenueLedgerTx[] })),
        ]);
        setEvents(evs);
        setTransactions(ledger.transactions);
        const live = evs.filter((e) => e.status === 'approved');
        const perEvent = await Promise.all(live.map((e) => venuePartner.attendees(e.id).catch(() => [] as OrgAttendee[])));
        setAttendees(perEvent.flat());
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load dashboard'))
      .finally(() => { setStatusLoaded(true); setLoading(false); });
  }, []);

  if (!statusLoaded || loading) return <Loader />;
  if (!hostingEnabled) return <VenueHosting />;

  const live = events.filter((e) => e.status === 'approved');
  const liveIds = new Set(live.map((e) => e.id));

  const topPool = live
    .map((e) => ({ ...e, soldTotal: e.tiers.reduce((a, t) => a + t.sold, 0) }))
    .filter((e) => e.soldTotal > 0)
    .sort((a, b) => b.soldTotal - a.soldTotal)
    .slice(0, 5);
  const maxTop = Math.max(...topPool.map((e) => e.soldTotal), 1);

  const capAll = live.reduce((a, e) => a + e.tiers.reduce((x, t) => x + t.quantity, 0), 0);
  const soldAll = live.reduce((a, e) => a + e.tiers.reduce((x, t) => x + t.sold, 0), 0);
  const checkedIn = attendees.filter((a) => a.checkedIn).length;
  const refundedCount = transactions.filter((t) => t.type === 'refund' && (!t.eventId || liveIds.has(t.eventId))).length;
  const uniqueCustomers = new Set(attendees.map((a) => a.whatsapp)).size;

  const cutoff30 = Date.now() - 30 * DAY_MS;
  const recent = transactions.filter((t) => new Date(t.createdAt).getTime() >= cutoff30);
  const bookings30d = recent.filter((t) => t.type === 'sale').length;
  const revenue30d = recent.filter((t) => t.type === 'sale' || t.type === 'refund').reduce((a, t) => a + t.amount, 0);

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const dayStart = Date.now() - (13 - i) * DAY_MS;
    const d = new Date(dayStart);
    d.setHours(0, 0, 0, 0);
    const dayEnd = d.getTime() + DAY_MS;
    return transactions.filter((t) => t.type === 'sale' && new Date(t.createdAt).getTime() >= d.getTime() && new Date(t.createdAt).getTime() < dayEnd).length;
  });
  const maxDay = Math.max(...last14, 1);

  const upcoming = [...live].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 4);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: 24 }}>Dashboard</h1>
        <Link to="/venue/hosting/events/create" className="btn btn-pri">
          + Create event
        </Link>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 14 }}>{err}</div>}

      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <div className="l">Bookings (30d)</div>
          <div className="v">{bookings30d.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="l">Revenue (30d)</div>
          <div className="v">{fmtMoney(revenue30d)}</div>
        </div>
        <div className="kpi">
          <div className="l">Live events</div>
          <div className="v">{live.length}</div>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="l">Your customers</div>
          <div className="v">{uniqueCustomers.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="l">Your events (all statuses)</div>
          <div className="v">{events.length}</div>
        </div>
        <div className="kpi">
          <div className="l">Total bookings (all-time)</div>
          <div className="v">{transactions.filter((t) => t.type === 'sale').length.toLocaleString()}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 10 }}>Top selling events</h3>
        {topPool.length ? (
          topPool.map((e) => (
            <div key={e.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="bold">{e.title}</span>
                <span className="muted small">{e.soldTotal.toLocaleString()} sold</span>
              </div>
              <div className="bar" style={{ marginTop: 4 }}>
                <div style={{ width: `${(e.soldTotal / maxTop) * 100}%` }} />
              </div>
            </div>
          ))
        ) : (
          <div className="muted small">No sales yet.</div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 4 }}>Ticket statistics</h3>
        <div className="tiny muted-2" style={{ marginBottom: 10 }}>
          across your {live.length} live events · capacity {capAll.toLocaleString()}
        </div>
        {(
          [
            ['Sold', soldAll, 'var(--accent)'],
            ['Available', Math.max(0, capAll - soldAll), 'rgba(155,225,61,.35)'],
            ['Checked in', checkedIn, '#8ab4f8'],
            ['Refunded', refundedCount, 'var(--danger)'],
          ] as [string, number, string][]
        ).map(([label, v, color]) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{label}</span>
              <span className="bold">{v.toLocaleString()}</span>
            </div>
            <div className="bar" style={{ marginTop: 3 }}>
              <div style={{ width: `${(v / Math.max(soldAll, capAll - soldAll, 1)) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
        <div className="tiny muted-2">
          sell-through {capAll ? Math.round((soldAll / capAll) * 100) : 0}%
          {soldAll ? ` · check-in rate ${Math.round((checkedIn / soldAll) * 100)}%` : ''}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 4 }}>Bookings over time</h3>
        <div className="muted tiny">last 14 days</div>
        <div className="chart">
          {last14.map((v, i) => (
            <div key={i} className="col" style={{ height: `${(v / maxDay) * 100}%` }} title={`${v} bookings`} />
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Upcoming events</h3>
        {upcoming.length === 0 && <div className="muted small">No live events yet.</div>}
        {upcoming.map((e) => {
          const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
          const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
          return (
            <div key={e.id} className="evrow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bold small">
                  {e.title} <span className="muted">· {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <div className="bar">
                    <div style={{ width: `${cap ? (sold / cap) * 100 : 0}%` }} />
                  </div>
                  <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
                    {sold.toLocaleString()} / {cap.toLocaleString()} sold
                  </span>
                </div>
              </div>
              <Link to={`/venue/hosting/bookings?event=${e.id}`} className="btn btn-ghost btn-sm">
                Attendees →
              </Link>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px dashed var(--border-dash)', paddingTop: 18, marginTop: 4 }}>
        <VenueHosting />
      </div>
    </div>
  );
}
