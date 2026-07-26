import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Kpi } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { liveEvents, liveGuestList, LiveApiError, type LiveEvent, type LiveGuestListEntry } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Guest list';

/** Free-entry guest list per event — real GuestListEntry rows, staff-added,
 * separate from PromoterGuest (no payout implications). */
export default function GuestList() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [guestList, setGuestList] = useState<{ entries: LiveGuestListEntry[]; namesCount: number; totalHeads: number; arrived: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plusOnes, setPlusOnes] = useState(0);
  const [companions, setCompanions] = useState<{ name: string; phone: string }[]>([]);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    Promise.all([liveEvents.list(), liveGuestList.list(id)])
      .then(([evs, g]) => {
        setEvents(evs);
        setGuestList(g);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const event = events.find((e) => e.id === id);

  if (!loading && !event) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Event not found</h1>
        <Link to="/events" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Events</Link>
      </div>
    );
  }
  if (!event || !guestList) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const setCompanion = (i: number, patch: Partial<{ name: string; phone: string }>) =>
    setCompanions((prev) => {
      const next = [...prev];
      while (next.length < i + 1) next.push({ name: '', phone: '' });
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Guest name is required'); return; }
    if (!phone.trim()) { setErr('WhatsApp number is required for the main guest'); return; }
    const comps = companions.slice(0, plusOnes);
    for (let i = 0; i < plusOnes; i++) {
      if (!comps[i]?.name.trim()) { setErr(`Name is required for plus-one ${i + 1}`); return; }
      if (!comps[i]?.phone.trim()) { setErr(`WhatsApp number is required for plus-one ${i + 1}`); return; }
    }
    try {
      await liveGuestList.add(event.id, {
        name: name.trim(),
        phone: phone.trim(),
        plusOnes,
        companions: comps.map((c) => ({ name: c.name.trim(), phone: c.phone.trim() })),
      });
      setName(''); setPhone(''); setPlusOnes(0); setCompanions([]);
      setErr('');
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add guest');
    }
  };

  const toggleArrived = async (gid: string) => {
    try { await liveGuestList.toggleArrived(gid); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to update'); }
  };
  const removeGuest = async (gid: string) => {
    try { await liveGuestList.remove(gid); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Guest', 'Phone', 'Plus-ones', 'Companions', 'Added by', 'Arrived'],
      ...guestList.entries.map((g) => [
        g.name, g.phone, g.plusOnes,
        g.companions.map((c) => `${c.name} (${c.phone})`).join('; '),
        g.addedBy, g.arrived ? 'yes' : 'no',
      ]),
    ];
    downloadCsv(`prebooze-guest-list-${event.slug}.csv`, rows);
  };

  return (
    <div className="stack fade" style={{ maxWidth: 760, gap: 14 }}>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/events/${event.id}`} style={{ fontSize: 13 }}>← {event.title}</Link>
        <h1 className="page-title">Guest list</h1>
        <span className="tag tag-green">free entry</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}>⬇ Export</button>
      </div>

      <div className="kpi-grid">
        <Kpi label="Names on list" value={guestList.namesCount} />
        <Kpi label="Total heads (incl. +1s)" value={guestList.totalHeads} />
        <Kpi label="Arrived" value={<span className="green">{guestList.arrived}</span>} />
      </div>

      <form className="card" style={{ border: '1px solid var(--green)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={add}>
        <div className="field" style={{ flex: 1.4, minWidth: 150 }}>
          <label>Guest name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DJ Nova (artist)" />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 130 }}>
          <label>WhatsApp number *</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" />
        </div>
        <div className="field" style={{ width: 130 }}>
          <label>Plus-ones</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlusOnes((p) => Math.max(0, p - 1))}>−</button>
            <b>+{plusOnes}</b>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlusOnes((p) => Math.min(6, p + 1))}>+</button>
          </div>
        </div>
        <button type="submit" className="btn btn-pri" style={{ height: 38 }}>Add to list ✓</button>
        {plusOnes > 0 && (
          <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px dashed rgba(139,195,74,.25)', paddingTop: 8 }}>
            <span className="tiny muted">name &amp; WhatsApp number required for each plus-one (checked at the gate):</span>
            {Array.from({ length: plusOnes }, (_, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="input"
                  style={{ flex: 1.4, minWidth: 140 }}
                  value={companions[i]?.name ?? ''}
                  onChange={(e) => setCompanion(i, { name: e.target.value })}
                  placeholder={`Plus-one ${i + 1} name *`}
                />
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 120 }}
                  value={companions[i]?.phone ?? ''}
                  onChange={(e) => setCompanion(i, { phone: e.target.value })}
                  placeholder="WhatsApp number *"
                />
              </div>
            ))}
          </div>
        )}
      </form>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 1.8 }}>Guest</span>
          <span style={{ flex: 1 }}>Phone</span>
          <span style={{ flex: 0.7 }}>Heads</span>
          <span style={{ flex: 1 }}>Added by</span>
          <span style={{ flex: 1 }}>At the gate</span>
          <span style={{ width: 40 }} />
        </div>
        {guestList.entries.map((g) => (
          <div key={g.id} className="trow" style={{ minWidth: 560 }}>
            <span style={{ flex: 1.8, fontWeight: 700 }}>
              {g.name}
              {g.plusOnes > 0 && <span className="muted"> +{g.plusOnes}</span>}
              {g.companions.length > 0 && (
                <span className="tiny muted" style={{ display: 'block', fontWeight: 400 }}>
                  with {g.companions.map((c) => c.name + (c.phone ? ` (${c.phone})` : '')).join(', ')}
                </span>
              )}
            </span>
            <span style={{ flex: 1 }} className="muted">{g.phone ?? '—'}</span>
            <span style={{ flex: 0.7 }}>{1 + g.plusOnes}</span>
            <span style={{ flex: 1 }} className="muted">{g.addedBy}</span>
            <span style={{ flex: 1 }}>
              <button
                className={`chip ${g.arrived ? 'on' : ''}`}
                style={{ fontSize: 10.5, padding: '3px 10px' }}
                onClick={() => toggleArrived(g.id)}
              >
                {g.arrived ? 'Arrived ✓' : 'Mark arrived'}
              </button>
            </span>
            <span style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => removeGuest(g.id)}>✕</button>
            </span>
          </div>
        ))}
        {guestList.entries.length === 0 && !loading && <div className="trow muted">Nobody on the list yet — add artists, press and VIPs above.</div>}
      </div>
      <div className="tiny hint">guest-list names show at the gate scanner as free entries · they don't consume ticket inventory</div>
    </div>
  );
}
