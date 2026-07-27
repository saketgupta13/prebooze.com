import { useEffect, useState } from 'react';
import { organizer, promoter, type OrgGuestListEntry, type OrgPromoterGuest } from '../../api';
import { ApiError } from '../../api/client';
import { cutoffDate, countdownLabel } from '../../lib/promoterPass';
import type { Event } from '../../types';

/** Real free-entry guest list — GET/POST /organizer/events/:id/guest-list
 * (reuses the same GuestListEntry model + GuestListService admin already
 * had), plus the real promoter-guests section below it. */
export default function OrgGuestList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [entries, setEntries] = useState<OrgGuestListEntry[]>([]);
  const [stats, setStats] = useState({ namesCount: 0, totalHeads: 0, arrived: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plusOnes, setPlusOnes] = useState(0);
  const [companions, setCompanions] = useState<{ name: string; phone: string }[]>([]);

  useEffect(() => {
    organizer
      .events()
      .then((evs) => {
        setEvents(evs);
        if (evs.length) setEventId(evs[0].id);
        else setLoading(false);
      })
      .catch((e) => { setErr(e instanceof ApiError ? e.message : 'Failed to load'); setLoading(false); });
  }, []);

  const loadGuestList = (id: string) => {
    if (!id) return;
    setLoading(true);
    organizer
      .guestList(id)
      .then((res) => { setEntries(res.entries); setStats(res); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load guest list'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (eventId) loadGuestList(eventId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [eventId]);

  const setCompanion = (i: number, patch: Partial<{ name: string; phone: string }>) =>
    setCompanions((prev) => {
      const next = [...prev];
      while (next.length < i + 1) next.push({ name: '', phone: '' });
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await organizer.addGuestListEntry(eventId, { name: name.trim(), phone: phone.trim(), plusOnes, companions: companions.slice(0, plusOnes) });
      setName('');
      setPhone('');
      setPlusOnes(0);
      setCompanions([]);
      loadGuestList(eventId);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to add guest');
    }
  };

  const toggleArrived = async (id: string) => {
    try {
      await organizer.toggleGuestArrived(id);
      loadGuestList(eventId);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update');
    }
  };

  const remove = async (id: string) => {
    try {
      await organizer.removeGuestListEntry(id);
      loadGuestList(eventId);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to remove');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>
          Guest list <span className="badge badge-ok">free entry</span>
        </h1>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ maxWidth: 240 }}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      {events.length === 0 && <div className="muted small">Create an event first — the guest list is per event.</div>}

      {eventId && (
        <>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi"><div className="l">Names on list</div><div className="v">{stats.namesCount}</div></div>
            <div className="kpi"><div className="l">Total heads (incl. +1s)</div><div className="v">{stats.totalHeads}</div></div>
            <div className="kpi"><div className="l">Arrived</div><div className="v accent">{stats.arrived}</div></div>
          </div>

          <form className="card" style={{ marginBottom: 16 }} onSubmit={add}>
            <div className="form-row">
              <div className="field">
                <span>Guest name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DJ Nova (artist)" />
              </div>
              <div className="field">
                <span>WhatsApp number *</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" />
              </div>
              <div className="field" style={{ flex: '0 0 150px' }}>
                <span>Plus-ones</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlusOnes((p) => Math.max(0, p - 1))}>−</button>
                  <b>+{plusOnes}</b>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlusOnes((p) => Math.min(6, p + 1))}>+</button>
                </div>
              </div>
            </div>
            {plusOnes > 0 && (
              <div style={{ borderTop: '1px dashed var(--border-dash)', paddingTop: 10, marginBottom: 12 }}>
                <div className="tiny muted-2" style={{ marginBottom: 8 }}>name &amp; WhatsApp number required for each plus-one (checked at the gate):</div>
                {Array.from({ length: plusOnes }, (_, i) => (
                  <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                    <input
                      value={companions[i]?.name ?? ''}
                      onChange={(e) => setCompanion(i, { name: e.target.value })}
                      placeholder={`Plus-one ${i + 1} name *`}
                    />
                    <input
                      value={companions[i]?.phone ?? ''}
                      onChange={(e) => setCompanion(i, { phone: e.target.value })}
                      placeholder="WhatsApp number *"
                    />
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-pri">Add to list ✓</button>
          </form>

          <div className="card">
            {loading && <div className="muted small">Loading…</div>}
            {!loading && entries.length === 0 && <div className="muted small">Nobody on the list yet — add artists, press and VIPs above.</div>}
            {entries.map((g) => (
              <div key={g.id} className="evrow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small">
                    {g.name}
                    {g.plusOnes > 0 && <span className="muted"> +{g.plusOnes}</span>}
                  </div>
                  {g.companions.length > 0 && (
                    <div className="tiny muted">
                      with {g.companions.map((c) => c.name + (c.phone ? ` (${c.phone})` : '')).join(', ')}
                    </div>
                  )}
                  <div className="tiny muted-2">
                    {g.phone || 'no phone'} · {1 + g.plusOnes} head{g.plusOnes ? 's' : ''} · added by {g.addedBy}
                  </div>
                </div>
                <button className={`chip ${g.arrived ? 'on' : ''}`} onClick={() => toggleArrived(g.id)}>
                  {g.arrived ? 'Arrived ✓' : 'Mark arrived'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}
                  onClick={() => { if (window.confirm(`Remove ${g.name} from the guest list?`)) remove(g.id); }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="tiny muted-2" style={{ marginTop: 10 }}>
            guest-list names show in the scanner as free entries · they don't consume ticket inventory
          </div>

          <PromoterGuestsSection eventId={eventId} events={events} />
        </>
      )}
    </div>
  );
}

/** Real promoter-brought guests for this event, across every promoter —
 * GET /organizer/events/:id/promoter-guests, check-in via the same real
 * POST /promoter/guests/:id/check-in a promoter uses (already authorizes
 * the owning organizer, see PromoterService.checkIn). */
function PromoterGuestsSection({ eventId, events }: { eventId: string; events: Event[] }) {
  const [guests, setGuests] = useState<OrgPromoterGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const event = events.find((e) => e.id === eventId);

  const load = () => {
    setLoading(true);
    organizer.promoterGuests(eventId).then(setGuests).finally(() => setLoading(false));
  };
  useEffect(load, [eventId]);

  if (!event?.promoterConfig || !(event.promoterConfig as { enabled?: boolean }).enabled) return null;
  const cfg = event.promoterConfig as { enabled: boolean; cap: number };
  const cutoff = cutoffDate(event);
  const closed = cutoff ? Date.now() >= cutoff.getTime() : false;
  const byPromoter = new Map<string, OrgPromoterGuest[]>();
  guests.forEach((g) => {
    const arr = byPromoter.get(g.promoterSlug) ?? [];
    arr.push(g);
    byPromoter.set(g.promoterSlug, arr);
  });
  const arrived = guests.filter((g) => g.arrived).length;

  const checkIn = async (id: string) => {
    try {
      await promoter.checkInGuest(id);
      load();
    } catch {
      // no-op — real errors surface via the promoter's own console; this is a best-effort door action
    }
  };

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
        <h3>Promoter guests <span className="badge badge-accent">free entry</span></h3>
        <span className="small muted">
          {arrived}/{guests.length} arrived · cap {cfg.cap} ·{' '}
          {closed ? <span className="danger-text">list closed</span> : cutoff ? <>closes in <b className="accent">{countdownLabel(cutoff)}</b></> : ''}
        </span>
      </div>
      {loading && <div className="muted small" style={{ marginTop: 8 }}>Loading…</div>}
      {!loading && guests.length === 0 ? (
        <div className="muted small" style={{ marginTop: 8 }}>No promoter guests yet for this event.</div>
      ) : (
        [...byPromoter.entries()].map(([slug, list]) => (
          <div key={slug} style={{ marginTop: 12 }}>
            <div className="small bold" style={{ marginBottom: 4 }}>
              📣 {slug} <span className="muted" style={{ fontWeight: 400 }}>· {list.filter((g) => g.arrived).length}/{list.length} in</span>
            </div>
            {list.map((g) => (
              <div key={g.id} className="evrow">
                <span style={{ flex: 1.6 }} className="bold small">{g.name}</span>
                <span style={{ flex: 1 }} className="muted small">{g.phone}</span>
                <span style={{ flex: 0.7 }} className="small">{g.age} · {g.gender?.[0]}</span>
                <span style={{ flex: 1 }}>
                  <button
                    className={`chip ${g.arrived ? 'on' : ''}`}
                    style={{ fontSize: 10.5, padding: '3px 10px' }}
                    disabled={g.arrived || (closed && !g.arrived)}
                    title={closed && !g.arrived ? 'Free window closed' : ''}
                    onClick={() => checkIn(g.id)}
                  >
                    {g.arrived ? 'Arrived ✓' : closed ? 'No-show' : 'Check in'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        ))
      )}
      <div className="tiny muted-2" style={{ marginTop: 10 }}>
        each guest is tagged with the promoter who brought them · after the cutoff, un-arrived guests count as no-shows
      </div>
    </div>
  );
}
