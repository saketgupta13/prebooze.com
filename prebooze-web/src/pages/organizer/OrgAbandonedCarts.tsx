import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtMoney, isEventOver } from '../../data/mock';
import { organizer } from '../../api';
import { ApiError } from '../../api/client';
import type { CartRecord } from '../../store/AppContext';
import type { Event } from '../../types';
import { X, RotateCcw, MessageCircle } from 'lucide-react';

const ago = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** Real abandoned-cart recovery — GET /organizer/carts (already filtered to
 * genuinely-abandoned carts server-side) + POST /organizer/carts/:id/remind,
 * which sends a real WhatsApp cart_reminder. The old mock's "In progress"
 * and "Recovered after nudge" KPIs are dropped — the real cart model has no
 * "recovered" state to count (a completed cart just stops showing up here),
 * so those numbers had nothing real to compute from. Used to also show a
 * transaction-history section (real sales/refunds grouped by event) below
 * the cart list, but that duplicated Transactions.tsx exactly — same ledger
 * data, minus the real filtering/export Transactions.tsx actually has —
 * dropped per organizer feedback (2026-09-15), same fix already made in the
 * RN organizer app. Live/Past split (also per organizer feedback,
 * 2026-09-15) uses the same date+durationHrs isEventOver() math as
 * Bookings.tsx, not just event.date — a cart for an event currently in
 * progress still counts as Live, since a reminder can still land before it
 * actually ends, not just before it starts. */
export default function OrgAbandonedCarts() {
  const [events, setEvents] = useState<Event[]>([]);
  const [carts, setCarts] = useState<CartRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [scope, setScope] = useState<'live' | 'past'>('live');
  const [eventF, setEventF] = useState('all');
  const [reminding, setReminding] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('cartId');
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const load = () => {
    Promise.all([organizer.events(), organizer.abandonedCarts()])
      .then(([evs, cs]) => { setEvents(evs); setCarts(cs); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Deep-link from the notification bell (a cart doesn't warrant its own
  // detail page — same call the RN app made — so we just open the list on
  // the right tab and scroll to/highlight the row).
  useEffect(() => {
    if (!highlightId || loading) return;
    const cart = carts.find((c) => c.id === highlightId);
    if (!cart) return;
    if (cartEventOver(cart) && scope !== 'past') setScope('past');
    else if (!cartEventOver(cart) && scope !== 'live') setScope('live');
    const t = setTimeout(() => rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, loading, carts]);

  const switchScope = (s: 'live' | 'past') => {
    setScope(s);
    setEventF('all');
  };

  const eventsById = new Map(events.map((e) => [e.id, e]));
  // A cart whose event has since been removed (rare) stays visible under
  // Live rather than silently vanishing under Past.
  const cartEventOver = (c: CartRecord) => {
    const e = eventsById.get(c.eventId);
    return e ? isEventOver(e) : false;
  };

  const eventsInScope = events.filter((e) => (scope === 'live' ? !isEventOver(e) : isEventOver(e)));
  const scoped = carts.filter((c) => (scope === 'live' ? !cartEventOver(c) : cartEventOver(c)));
  const mine = scoped.filter((c) => eventF === 'all' || c.eventId === eventF).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recoverable = mine.reduce((a, c) => a + c.total, 0);

  const remind = async (id: string) => {
    setReminding(id);
    try {
      await organizer.remindCart(id);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to send reminder');
    } finally {
      setReminding(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>
          Abandoned carts <span className="badge badge-pending">recover revenue</span>
        </h1>
        <select value={eventF} onChange={(e) => setEventF(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="all">All events</option>
          {eventsInScope.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={scope === 'live' ? 'on' : ''} onClick={() => switchScope('live')}>Live</button>
        <button className={scope === 'past' ? 'on' : ''} onClick={() => switchScope('past')}>Past</button>
      </div>

      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}

      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="l">Abandoned carts</div><div className="v">{mine.length}</div></div>
        <div className="kpi"><div className="l">Recoverable</div><div className="v accent">{fmtMoney(recoverable)}</div></div>
      </div>

      <div className="card tbl-wrap" style={{ marginBottom: 18 }}>
        <p className="tiny muted-2" style={{ marginBottom: 12 }}>
          {scope === 'live'
            ? "These guests reached checkout but didn't pay before their hold lapsed — you already have their WhatsApp. A nudge often brings them back before the event happens."
            : "These carts are for events that have already ended — a reminder can't recover them anymore, kept here just for the record."}
        </p>
        {loading && <div className="muted small">Loading…</div>}
        {!loading && mine.length === 0 ? (
          <div className="muted small">
            {scope === 'live'
              ? "No abandoned carts right now — nice. They'll appear here when a guest leaves checkout without paying."
              : 'No abandoned carts from past events.'}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Event · tickets</th>
                <th>Value</th>
                <th>Left</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mine.map((c) => (
                <tr key={c.id} ref={(el) => { rowRefs.current[c.id] = el; }} className={c.id === highlightId ? 'row-highlight' : undefined}>
                  <td>
                    <div className="bold small">{c.userName}</div>
                    <div className="tiny muted-2">{c.userPhone}</div>
                  </td>
                  <td>
                    <div className="small">{c.eventTitle}</div>
                    <div className="tiny muted-2">{c.tierSummary}</div>
                  </td>
                  <td className="bold small">{fmtMoney(c.total)}</td>
                  <td className="tiny muted-2">{ago(c.updatedAt)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      {c.remindedAt && <span className="badge badge-accent" style={{ fontSize: 10 }}>reminded {ago(c.remindedAt)}</span>}
                      <button className="btn btn-whatsapp btn-sm" disabled={reminding === c.id} onClick={() => remind(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {reminding === c.id ? 'Sending…' : c.remindedAt ? <><RotateCcw size={13} /> Remind again</> : <><MessageCircle size={13} /> Send reminder</>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="tiny muted-2">
        recovery nudges are reminder + deep link only (no discount)
      </div>
    </div>
  );
}
