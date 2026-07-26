import { useEffect, useMemo, useState } from 'react';
import { fmt } from '../store/data';
import { Kpi, SearchBox } from '../components/ui';
import { liveCarts, liveEvents, LiveApiError, type LiveCart, type LiveCartStats, type LiveEvent } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Abandoned carts';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Platform-wide abandoned-cart recovery — real active carts (CartsService),
 * real KPIs (open/recoverable/recovered/recovery-rate — carts.stats(), added
 * alongside this merge since the recovered side wasn't exposed anywhere
 * before), and remind/bulk-remind that genuinely sends a WhatsApp + email
 * nudge instead of a mock toast. Same layout as the old mock page. */
export default function AbandonedCarts() {
  const session = useLiveSession();
  const { token } = session;

  const [carts, setCarts] = useState<LiveCart[]>([]);
  const [stats, setStats] = useState<LiveCartStats | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [eventF, setEventF] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveCarts.list(), liveCarts.stats(), liveEvents.list()])
      .then(([c, s, e]) => {
        setCarts(c);
        setStats(s);
        setEvents(e);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const eventTitle = (id: string) => events.find((e) => e.id === id)?.title ?? id;

  const filtered = useMemo(() => {
    let l = carts;
    if (eventF !== 'all') l = l.filter((c) => c.eventId === eventF);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((c) => c.guest.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return l;
  }, [carts, eventF, query]);

  const unremindedIds = filtered.filter((c) => !c.reminded).map((c) => c.id);

  const byEvent = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    carts.forEach((c) => {
      const cur = m.get(c.eventId) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += c.amount;
      m.set(c.eventId, cur);
    });
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [carts]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const remind = async (id: string) => {
    setErr('');
    try {
      await liveCarts.remind(id);
      setMsg('Reminder sent ✓');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send reminder');
    }
  };

  const bulkRemind = async (ids: string[]) => {
    if (!ids.length) return;
    setErr('');
    try {
      const res = await liveCarts.bulkRemind(ids);
      setMsg(`${res.count} reminder(s) sent ✓`);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send reminders');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {msg && <div className="tiny" style={{ color: 'var(--green)' }}>{msg}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Abandoned carts</h1>
        <button
          className="btn btn-pri"
          disabled={unremindedIds.length === 0}
          onClick={() => bulkRemind(unremindedIds)}
        >
          💬 Nudge all {unremindedIds.length ? `(${unremindedIds.length})` : ''}
        </button>
      </div>

      {stats && (
        <div className="kpi-grid">
          <Kpi label="Open carts" value={fmt(stats.openCount)} />
          <Kpi label="Recoverable" value={`₹${fmt(stats.recoverable)}`} delta="if recovered" deltaColor="var(--muted)" />
          <Kpi label="Recovery rate" value={`${stats.recoveryRate}%`} delta={`₹${fmt(stats.recoveredValue)} recovered`} deltaColor="var(--green)" />
          <Kpi label="Recovered carts" value={fmt(stats.recoveredCount)} />
        </div>
      )}

      {/* Event-wise breakdown */}
      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>By event</div>
        {byEvent.length === 0 ? (
          <div className="muted small">No open abandoned carts.</div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {byEvent.map(([id, v]) => {
              const maxV = byEvent[0][1].value;
              return (
                <div key={id} style={{ cursor: 'pointer' }} onClick={() => setEventF(id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <b>{eventTitle(id)}</b>
                    <span className="muted">{v.count} cart{v.count === 1 ? '' : 's'} · ₹{fmt(v.value)} recoverable</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(139,195,74,.12)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                    <div style={{ width: `${(v.value / maxV) * 100}%`, height: '100%', background: 'var(--green)', opacity: 0.5 + (v.value / maxV) * 0.5 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="guest / phone…" style={{ flex: 1, minWidth: 180 }} />
        <select
          className="chip"
          style={{ appearance: 'none', cursor: 'pointer', background: eventF !== 'all' ? 'var(--green)' : 'var(--bg)', color: eventF !== 'all' ? 'var(--on-green)' : '#c7cbb9' }}
          value={eventF}
          onChange={(e) => setEventF(e.target.value)}
        >
          <option value="all">All events ▾</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 720 }}>
          <span style={{ flex: 1.4 }}>Guest</span>
          <span style={{ flex: 1.6 }}>Event</span>
          <span style={{ flex: 0.8 }}>Value</span>
          <span style={{ flex: 0.7 }}>Abandoned</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1.2 }} />
        </div>
        {filtered.map((c) => (
          <div key={c.id} className="trow" style={{ minWidth: 720 }}>
            <span style={{ flex: 1.4 }}>
              <b>{c.guest}</b>
              <span className="tiny muted" style={{ display: 'block' }}>{c.phone}</span>
            </span>
            <span style={{ flex: 1.6 }}>{c.eventTitle}</span>
            <span style={{ flex: 0.8, fontWeight: 700 }}>₹{fmt(c.amount)}</span>
            <span style={{ flex: 0.7 }} className="muted tiny">{timeAgo(c.createdAt)}</span>
            <span style={{ flex: 1 }}>
              {c.reminded ? (
                <span className="tag" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>reminded</span>
              ) : (
                <span className="tag" style={{ borderColor: 'var(--border)' }}>abandoned</span>
              )}
            </span>
            <span style={{ flex: 1.2, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => remind(c.id)}>
                {c.reminded ? '↻ Remind again' : '💬 Send reminder'}
              </button>
            </span>
          </div>
        ))}
        {filtered.length === 0 && !loading && <div className="trow muted">No abandoned carts match.</div>}
      </div>
      <div className="tiny hint">
        recovery is a real WhatsApp + email reminder (no discount) · organizers pay nothing to recover — this is platform oversight
      </div>
    </div>
  );
}
