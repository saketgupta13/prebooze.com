import { useEffect, useState } from 'react';
import { liveEvents, liveGuestList, liveLiveMonitor, liveManualBooking, LiveApiError, type LiveEvent, type LiveGuestListEntry, type LiveMonitor } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Guest list, live monitor & manual booking (live)';
type Tab = 'guestlist' | 'live' | 'manual';

/** Three per-event real ops tools sharing one event selector. Guest list is
 * the staff-added free list (GuestListEntry) — separate from PromoterGuest,
 * no payout implications. Live monitor's histogram/scan-rate chart stays on
 * the mock page; the real headline numbers (checked in / remaining / rate)
 * are here. Manual booking genuinely creates a real Booking + real Invoice,
 * same as a guest checkout, just staff-recorded (phone order/walk-up/comp). */
export default function EventOpsLive() {
  const session = useLiveSession();
  const { token } = session;
  const [tab, setTab] = useState<Tab>('guestlist');
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [guestList, setGuestList] = useState<{ entries: LiveGuestListEntry[]; totalHeads: number; arrived: number } | null>(null);
  const [live, setLive] = useState<LiveMonitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [glName, setGlName] = useState('');
  const [glPhone, setGlPhone] = useState('');
  const [ciName, setCiName] = useState('');
  const [ciCount, setCiCount] = useState('1');
  const [mbTierId, setMbTierId] = useState('');
  const [mbQty, setMbQty] = useState('1');
  const [mbName, setMbName] = useState('');
  const [mbPhone, setMbPhone] = useState('');

  useEffect(() => {
    if (token) {
      liveEvents.list().then((evs) => {
        setEvents(evs);
        if (evs.length && !eventId) setEventId(evs.find((e) => e.status === 'approved')?.id ?? evs[0].id);
      }).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load events'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadEventData = () => {
    if (!eventId) return;
    setLoading(true);
    setErr('');
    Promise.all([liveGuestList.list(eventId), liveLiveMonitor.get(eventId)])
      .then(([g, l]) => { setGuestList(g); setLive(l); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEventData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const selectedEvent = events.find((e) => e.id === eventId);

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!glName.trim() || !glPhone.trim()) return;
    try {
      await liveGuestList.add(eventId, { name: glName.trim(), phone: glPhone.trim() });
      setGlName(''); setGlPhone('');
      loadEventData();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add guest');
    }
  };

  const toggleArrived = async (id: string) => {
    try { await liveGuestList.toggleArrived(id); loadEventData(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to update'); }
  };
  const removeGuest = async (id: string) => {
    if (!window.confirm('Remove this guest?')) return;
    try { await liveGuestList.remove(id); loadEventData(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const checkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ciName.trim()) return;
    try {
      await liveLiveMonitor.checkIn(eventId, ciName.trim(), parseInt(ciCount, 10) || 1);
      setCiName(''); setCiCount('1');
      loadEventData();
      setMsg('Checked in ✓');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to check in');
    }
  };

  const createManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mbTierId || !mbName.trim() || !mbPhone.trim()) {
      setErr('Tier, guest name and phone are required');
      return;
    }
    try {
      await liveManualBooking.create({ eventId, tierId: mbTierId, qty: parseInt(mbQty, 10) || 1, guestName: mbName.trim(), phone: mbPhone.trim(), method: 'manual' });
      setMbName(''); setMbPhone(''); setMbQty('1');
      setMsg('Booking created ✓');
      loadEventData();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to create booking');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {msg && <div className="tiny" style={{ color: 'var(--green)' }}>{msg}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="field">
        <label>Event</label>
        <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.status})</option>)}
        </select>
      </div>

      <div className="tabs">
        <button className={tab === 'guestlist' ? 'on' : ''} onClick={() => setTab('guestlist')}>Guest list</button>
        <button className={tab === 'live' ? 'on' : ''} onClick={() => setTab('live')}>Live monitor</button>
        <button className={tab === 'manual' ? 'on' : ''} onClick={() => setTab('manual')}>Manual booking</button>
      </div>

      {tab === 'guestlist' && guestList && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="card" style={{ minWidth: 120, flex: 1 }}><div className="tiny muted">Names</div><div style={{ fontSize: 18, fontWeight: 800 }}>{guestList.entries.length}</div></div>
            <div className="card" style={{ minWidth: 120, flex: 1 }}><div className="tiny muted">Total heads</div><div style={{ fontSize: 18, fontWeight: 800 }}>{guestList.totalHeads}</div></div>
            <div className="card" style={{ minWidth: 120, flex: 1 }}><div className="tiny muted">Arrived</div><div style={{ fontSize: 18, fontWeight: 800 }}>{guestList.arrived}</div></div>
          </div>
          <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={addGuest}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Name</label><input className="input" value={glName} onChange={(e) => setGlName(e.target.value)} /></div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>WhatsApp phone</label><input className="input" value={glPhone} onChange={(e) => setGlPhone(e.target.value)} /></div>
            <button type="submit" className="btn btn-pri">+ Add to list</button>
          </form>
          <div className="tblwrap">
            {guestList.entries.map((g) => (
              <div key={g.id} className="trow">
                <span style={{ flex: 1.4, fontWeight: 700 }}>{g.name}{g.plusOnes > 0 ? ` +${g.plusOnes}` : ''}</span>
                <span style={{ flex: 1 }} className="tiny muted">{g.phone}</span>
                <span style={{ flex: 0.8 }}><button className="btn btn-ghost btn-sm" onClick={() => toggleArrived(g.id)}>{g.arrived ? 'Arrived ✓' : 'Not yet'}</button></span>
                <span style={{ flex: 0.4, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => removeGuest(g.id)}>✕</button></span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'live' && live && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="card" style={{ minWidth: 120, flex: 1 }}><div className="tiny muted">Total tickets</div><div style={{ fontSize: 18, fontWeight: 800 }}>{live.total}</div></div>
            <div className="card" style={{ minWidth: 120, flex: 1 }}><div className="tiny muted">Checked in</div><div style={{ fontSize: 18, fontWeight: 800 }}>{live.checkedIn} ({live.pct}%)</div></div>
            <div className="card" style={{ minWidth: 120, flex: 1 }}><div className="tiny muted">Remaining</div><div style={{ fontSize: 18, fontWeight: 800 }}>{live.remaining}</div></div>
            <div className="card" style={{ minWidth: 120, flex: 1 }}><div className="tiny muted">Rejected scans</div><div style={{ fontSize: 18, fontWeight: 800 }}>{live.rejected}</div></div>
          </div>
          <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={checkIn}>
            <div className="field" style={{ flex: 1, minWidth: 160 }}><label>Booking # or guest name</label><input className="input" value={ciName} onChange={(e) => setCiName(e.target.value)} /></div>
            <div className="field" style={{ width: 100 }}><label>Headcount</label><input className="input" inputMode="numeric" value={ciCount} onChange={(e) => setCiCount(e.target.value)} /></div>
            <button type="submit" className="btn btn-pri">Check in</button>
          </form>
        </>
      )}

      {tab === 'manual' && selectedEvent && (
        <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={createManualBooking}>
          <div className="field" style={{ width: 160 }}>
            <label>Tier</label>
            <select className="input" value={mbTierId} onChange={(e) => setMbTierId(e.target.value)}>
              <option value="">Select…</option>
              {selectedEvent.tiers.map((t) => <option key={t.id} value={t.id}>{t.name} — ₹{t.price}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 80 }}><label>Qty</label><input className="input" inputMode="numeric" value={mbQty} onChange={(e) => setMbQty(e.target.value)} /></div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Guest name</label><input className="input" value={mbName} onChange={(e) => setMbName(e.target.value)} /></div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Phone</label><input className="input" value={mbPhone} onChange={(e) => setMbPhone(e.target.value)} /></div>
          <button type="submit" className="btn btn-pri">Create booking</button>
        </form>
      )}
    </div>
  );
}
