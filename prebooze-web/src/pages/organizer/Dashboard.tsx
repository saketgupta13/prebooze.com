import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PromoteCard from '../../components/PromoteCard';
import Loader from '../../components/Loader';
import { organizer, type OrgAttendee } from '../../api';
import { ApiError } from '../../api/client';
import type { Event, Organizer } from '../../types';

const fmtMoney = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const DAY_MS = 86400000;

/** Real organizer dashboard — GET /organizer/me + /organizer/events +
 * /organizer/payouts (the real earnings ledger), plus /organizer/events/:id/
 * attendees for each live event to get real check-in/unique-customer counts.
 * Every number here is derived from those responses; nothing is seeded or
 * randomly generated. "Bookings" (not "tickets") is the honest unit for the
 * 30-day/trend numbers — the ledger records one `sale` entry per booking,
 * not per ticket, so claiming a ticket count there would be fabricated. */
export default function Dashboard() {
  const [profile, setProfile] = useState<Organizer | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [ledger, setLedger] = useState<{ id: string; type: string; amount: number; eventId?: string; createdAt: string }[]>([]);
  const [attendees, setAttendees] = useState<OrgAttendee[]>([]);
  const [topCity, setTopCity] = useState('All');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // `me()` is the only hard requirement — any team member (any role) can
  // call it (see OrganizerService.me). events/payouts/attendees are each
  // gated on their own permission module though, so a narrower role (e.g.
  // the default "Door staff", which has no Events/Payouts view) degrades
  // those sections to empty instead of failing the whole dashboard — the
  // relevant nav items are already hidden for that role anyway (see
  // OrganizerLayout), this just keeps the one always-visible page usable.
  useEffect(() => {
    organizer
      .me()
      .then(async (me) => {
        setProfile(me);
        const [evs, pay] = await Promise.all([
          organizer.events().catch(() => [] as Event[]),
          organizer.payouts().catch(() => ({ balance: 0, ledger: [] as { id: string; type: string; amount: number; eventId?: string; createdAt: string }[] })),
        ]);
        setEvents(evs);
        setLedger(pay.ledger);
        const live = evs.filter((e) => e.status === 'approved');
        const perEvent = await Promise.all(live.map((e) => organizer.attendees(e.id).catch(() => [] as OrgAttendee[])));
        setAttendees(perEvent.flat());
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const live = events.filter((e) => e.status === 'approved');
  const liveIds = new Set(live.map((e) => e.id));
  const cities = ['All', ...new Set(live.map((e) => e.venue?.city).filter(Boolean) as string[])];

  const topPool = live
    .map((e) => ({ ...e, soldTotal: e.tiers.reduce((a, t) => a + t.sold, 0), city: e.venue?.city ?? '' }))
    .filter((e) => e.soldTotal > 0 && (topCity === 'All' || e.city === topCity))
    .sort((a, b) => b.soldTotal - a.soldTotal)
    .slice(0, 5);
  const maxTop = Math.max(...topPool.map((e) => e.soldTotal), 1);

  const capAll = live.reduce((a, e) => a + e.tiers.reduce((x, t) => x + t.quantity, 0), 0);
  const soldAll = live.reduce((a, e) => a + e.tiers.reduce((x, t) => x + t.sold, 0), 0);
  const checkedIn = attendees.filter((a) => a.checkedIn).length;
  const refundedCount = ledger.filter((t) => t.type === 'refund' && (!t.eventId || liveIds.has(t.eventId))).length;
  const uniqueCustomers = new Set(attendees.map((a) => a.whatsapp)).size;

  const cutoff30 = Date.now() - 30 * DAY_MS;
  const recent = ledger.filter((t) => new Date(t.createdAt).getTime() >= cutoff30);
  const bookings30d = recent.filter((t) => t.type === 'sale').length;
  const revenue30d = recent.filter((t) => t.type === 'sale' || t.type === 'refund').reduce((a, t) => a + t.amount, 0);

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const dayStart = Date.now() - (13 - i) * DAY_MS;
    const d = new Date(dayStart);
    d.setHours(0, 0, 0, 0);
    const dayEnd = d.getTime() + DAY_MS;
    return ledger.filter((t) => t.type === 'sale' && new Date(t.createdAt).getTime() >= d.getTime() && new Date(t.createdAt).getTime() < dayEnd).length;
  });
  const maxDay = Math.max(...last14, 1);

  const upcoming = [...live].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 4);

  if (loading) return <Loader />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: 24 }}>Dashboard</h1>
        <Link to="/organizer/events/create" className="btn btn-pri">
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
          <div className="v">{ledger.filter((t) => t.type === 'sale').length.toLocaleString()}</div>
        </div>
      </div>

      {profile && (
        <PromoteCard type="organizer" refId={profile.id} city={profile.city || 'All'} label="your brand" />
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <h3>Top selling events</h3>
          <div className="chip-row">
            {cities.map((c) => (
              <button key={c} className={`chip ${topCity === c ? 'on' : ''}`} style={{ fontSize: 11, padding: '3px 11px' }} onClick={() => setTopCity(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        {topPool.length ? (
          topPool.map((e) => (
            <div key={e.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="bold">{e.title}</span>
                <span className="muted small">{e.soldTotal.toLocaleString()} sold · {e.city}</span>
              </div>
              <div className="bar" style={{ marginTop: 4 }}>
                <div style={{ width: `${(e.soldTotal / maxTop) * 100}%` }} />
              </div>
            </div>
          ))
        ) : (
          <div className="muted small">No sales in {topCity} yet.</div>
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

      <div className="card">
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
              <Link to={`/organizer/attendees?event=${e.id}`} className="btn btn-ghost btn-sm">
                Attendees →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
