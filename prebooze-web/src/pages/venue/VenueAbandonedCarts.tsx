import { useEffect, useState } from 'react';
import { fmtMoney } from '../../data/mock';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import type { CartRecord } from '../../store/AppContext';
import type { Event } from '../../types';

const ago = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** Venue-hosted equivalent of organizer/OrgAbandonedCarts.tsx — real cart
 * recovery scoped to this venue's own hosted events, via
 * GET /venue/hosting/carts + POST /venue/hosting/carts/:id/remind. */
export default function VenueAbandonedCarts() {
  const [events, setEvents] = useState<Event[]>([]);
  const [carts, setCarts] = useState<CartRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [eventF, setEventF] = useState('all');
  const [reminding, setReminding] = useState<string | null>(null);

  const load = () => {
    Promise.all([venuePartner.hostedEvents(), venuePartner.abandonedCarts()])
      .then(([evs, cs]) => { setEvents(evs); setCarts(cs); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const mine = carts.filter((c) => eventF === 'all' || c.eventId === eventF).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recoverable = mine.reduce((a, c) => a + c.total, 0);

  const remind = async (id: string) => {
    setReminding(id);
    try {
      await venuePartner.remindCart(id);
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
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="l">Abandoned carts</div><div className="v">{mine.length}</div></div>
        <div className="kpi"><div className="l">Recoverable</div><div className="v accent">{fmtMoney(recoverable)}</div></div>
      </div>

      <div className="card">
        <p className="tiny muted-2" style={{ marginBottom: 12 }}>
          These guests reached checkout but didn't pay before their hold lapsed — you already have their WhatsApp. A
          nudge often brings them back.
        </p>
        {loading && <div className="muted small">Loading…</div>}
        {!loading && mine.length === 0 ? (
          <div className="muted small">No abandoned carts right now — nice. They'll appear here when a guest leaves checkout without paying.</div>
        ) : (
          <>
            {mine.length > 0 && (
              <div className="evrow" style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ flex: 1.4 }}>Guest</span>
                <span style={{ flex: 1.6 }}>Event · tickets</span>
                <span style={{ flex: 0.8, textAlign: 'right' }}>Value</span>
                <span style={{ flex: 0.8 }}>Left</span>
                <span style={{ flex: 1.4 }} />
              </div>
            )}
            {mine.map((c) => (
              <div key={c.id} className="evrow">
                <div style={{ flex: 1.4, minWidth: 0 }}>
                  <div className="bold small">{c.userName}</div>
                  <div className="tiny muted-2">{c.userPhone}</div>
                </div>
                <div style={{ flex: 1.6, minWidth: 0 }}>
                  <div className="small">{c.eventTitle}</div>
                  <div className="tiny muted-2">{c.tierSummary}</div>
                </div>
                <span style={{ flex: 0.8, textAlign: 'right' }} className="bold small">{fmtMoney(c.total)}</span>
                <span style={{ flex: 0.8 }} className="tiny muted-2">{ago(c.updatedAt)}</span>
                <div style={{ flex: 1.4, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                  {c.remindedAt && <span className="badge badge-accent" style={{ fontSize: 10 }}>reminded {ago(c.remindedAt)}</span>}
                  <button className="btn btn-whatsapp btn-sm" disabled={reminding === c.id} onClick={() => remind(c.id)}>
                    {reminding === c.id ? 'Sending…' : c.remindedAt ? '↻ Remind again' : '💬 Send reminder'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>
        recovery nudges are reminder + deep link only (no discount)
      </div>
    </div>
  );
}
