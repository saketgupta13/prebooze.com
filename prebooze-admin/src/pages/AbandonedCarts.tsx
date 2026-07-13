import { useMemo, useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { Kpi, SearchBox } from '../components/ui';

/** Platform-wide abandoned-cart recovery — analytics, event-wise breakdown, and
 * a (simulated) bulk WhatsApp nudge. Organizer-owned leads surfaced for oversight. */
export default function AbandonedCarts() {
  const { abandonedCarts, events, remindCart2, bulkRemind } = useAdmin();
  const [eventF, setEventF] = useState('all');
  const [query, setQuery] = useState('');
  const eventTitle = (id: string) => events.find((e) => e.id === id)?.title ?? id;

  const filtered = useMemo(() => {
    let l = abandonedCarts;
    if (eventF !== 'all') l = l.filter((c) => c.eventId === eventF);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((c) => c.guest.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abandonedCarts, eventF, query]);

  const open = filtered.filter((c) => c.status === 'abandoned');
  const recovered = abandonedCarts.filter((c) => c.status === 'recovered');
  const recoverable = open.reduce((a, c) => a + c.amount, 0);
  const recoveredValue = recovered.reduce((a, c) => a + c.amount, 0);
  const recoveryRate = abandonedCarts.length ? Math.round((recovered.length / abandonedCarts.length) * 100) : 0;
  const unremindedIds = open.filter((c) => !c.reminded).map((c) => c.id);

  // event-wise breakdown (open carts only)
  const byEvent = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    open.forEach((c) => {
      const cur = m.get(c.eventId) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += c.amount;
      m.set(c.eventId, cur);
    });
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [open]);

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
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

      <div className="kpi-grid">
        <Kpi label="Open carts" value={fmt(open.length)} />
        <Kpi label="Recoverable" value={`₹${fmt(recoverable)}`} delta="if recovered" deltaColor="var(--muted)" />
        <Kpi label="Recovery rate" value={`${recoveryRate}%`} delta={`₹${fmt(recoveredValue)} recovered`} deltaColor="var(--green)" />
        <Kpi label="Recovered carts" value={fmt(recovered.length)} />
      </div>

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
          <span style={{ flex: 1.6 }}>Event · tickets</span>
          <span style={{ flex: 0.8 }}>Value</span>
          <span style={{ flex: 0.7 }}>Left</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1.2 }} />
        </div>
        {filtered.map((c) => (
          <div key={c.id} className="trow" style={{ minWidth: 720, background: c.status === 'recovered' ? 'rgba(139,195,74,.06)' : undefined }}>
            <span style={{ flex: 1.4 }}>
              <b>{c.guest}</b>
              <span className="tiny muted" style={{ display: 'block' }}>{c.phone}</span>
            </span>
            <span style={{ flex: 1.6 }}>
              {eventTitle(c.eventId)}
              <span className="tiny muted" style={{ display: 'block' }}>{c.tiers}</span>
            </span>
            <span style={{ flex: 0.8, fontWeight: 700 }}>₹{fmt(c.amount)}</span>
            <span style={{ flex: 0.7 }} className="muted tiny">{c.leftAt}</span>
            <span style={{ flex: 1 }}>
              {c.status === 'recovered' ? (
                <span className="tag tag-green">recovered ✓</span>
              ) : c.reminded ? (
                <span className="tag" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>reminded</span>
              ) : (
                <span className="tag" style={{ borderColor: 'var(--border)' }}>abandoned</span>
              )}
            </span>
            <span style={{ flex: 1.2, display: 'flex', justifyContent: 'flex-end' }}>
              {c.status === 'abandoned' && (
                <button className="btn btn-ghost btn-sm" onClick={() => remindCart2(c.id)}>
                  {c.reminded ? '↻ Remind again' : '💬 Send reminder'}
                </button>
              )}
            </span>
          </div>
        ))}
        {filtered.length === 0 && <div className="trow muted">No abandoned carts match.</div>}
      </div>
      <div className="tiny hint">
        recovery is a WhatsApp reminder + deep link (no discount) · organizers pay nothing to recover — this is platform oversight · sends are simulated until the backend lands
      </div>
    </div>
  );
}
