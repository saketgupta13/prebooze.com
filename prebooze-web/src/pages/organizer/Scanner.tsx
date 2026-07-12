import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { PROMOTERS, eventById } from '../../data/mock';
import { cutoffDate, isPassValid } from '../../lib/promoterPass';
import Stepper from '../../components/Stepper';

type ScanState =
  | { mode: 'scanning' }
  | { mode: 'valid'; bookingId: string }
  | { mode: 'promoter'; guestId: string }
  | { mode: 'invalid'; reason: string };

export default function Scanner() {
  const { bookings, checkInBooking, myEvents, promoterGuests, checkInPromoterGuest } = useApp();
  const [state, setState] = useState<ScanState>({ mode: 'scanning' });
  const [manual, setManual] = useState('');
  const [torch, setTorch] = useState(false);
  const [count, setCount] = useState(1);
  const [checkedInTotal, setCheckedInTotal] = useState(128);

  const findBooking = (idRaw: string) => {
    const id = idRaw.trim().toUpperCase();
    const norm = id.startsWith('#') ? id : '#' + id.replace(/^TKT-?/, 'TKT-');
    return bookings.find(
      (b) => b.id.toUpperCase() === norm || b.id.toUpperCase() === '#TKT-' + id.replace(/\D/g, '')
    );
  };

  const allEvents = [...myEvents];
  const eventOf = (id: string) => eventById(id) ?? allEvents.find((e) => e.id === id);

  const findPromoterGuest = (idRaw: string) => {
    const q = idRaw.trim().toLowerCase();
    return promoterGuests.find((g) => g.id.toLowerCase() === q || g.name.toLowerCase() === q);
  };

  const lookup = (idRaw: string) => {
    // promoter free-entry pass?
    const pg = findPromoterGuest(idRaw);
    if (pg) {
      const ev = eventOf(pg.eventId);
      if (pg.arrived) return setState({ mode: 'invalid', reason: 'This free-entry pass is already checked in' });
      if (ev && !isPassValid(ev)) return setState({ mode: 'invalid', reason: 'Free-entry window has closed for this pass' });
      return setState({ mode: 'promoter', guestId: pg.id });
    }
    const b = findBooking(idRaw);
    if (!b) return setState({ mode: 'invalid', reason: 'Not found — booking number or guest name unknown' });
    if (b.status !== 'confirmed')
      return setState({ mode: 'invalid', reason: 'Booking was cancelled / refunded' });
    if (b.guests.every((g) => g.checkedIn))
      return setState({ mode: 'invalid', reason: 'QR already used — all guests checked in' });
    setCount(b.guests.filter((g) => !g.checkedIn).length);
    setState({ mode: 'valid', bookingId: b.id });
  };

  const simulateScan = () => {
    // prefer a still-valid promoter free-entry pass, then a booking
    const pg = promoterGuests.find((g) => {
      if (g.arrived) return false;
      const ev = eventOf(g.eventId);
      return ev ? isPassValid(ev) : false;
    });
    if (pg) return lookup(pg.id);
    const candidate = bookings.find(
      (b) => b.status === 'confirmed' && b.guests.some((g) => !g.checkedIn)
    );
    if (candidate) lookup(candidate.id);
    else setState({ mode: 'invalid', reason: 'Nothing to scan yet — capture a promoter guest or make a booking first' });
  };

  if (state.mode === 'promoter') {
    const g = promoterGuests.find((x) => x.id === state.guestId)!;
    const ev = eventOf(g.eventId);
    const promoter = PROMOTERS.find((p) => p.slug === g.promoterSlug);
    const cutoff = ev ? cutoffDate(ev) : null;
    return (
      <div className="scanner card-shadow">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="confirm-tick">✓</div>
          <h2>Free entry — valid</h2>
          <div style={{ textAlign: 'left', margin: '18px 0' }}>
            <div className="kv"><span className="k">Guest</span><span className="bold">{g.name}</span></div>
            <div className="kv"><span className="k">Brought by</span><span>📣 {promoter?.name ?? g.promoterSlug}</span></div>
            <div className="kv"><span className="k">Age · gender</span><span>{g.age} · {g.gender}</span></div>
            <div className="kv"><span className="k">Event</span><span>{ev?.title}</span></div>
            {cutoff && <div className="kv"><span className="k">Free until</span><span>{cutoff.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></div>}
          </div>
          <button
            className="btn btn-pri btn-block btn-lg"
            onClick={() => {
              checkInPromoterGuest(g.id);
              setCheckedInTotal((t) => t + 1);
              setState({ mode: 'scanning' });
            }}
          >
            Check in {g.name.split(' ')[0]} ✓
          </button>
          <div className="tiny muted-2" style={{ marginTop: 10 }}>
            carry ID matching “{g.name}” · counts toward {promoter?.name ?? 'the promoter'}'s arrivals
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setState({ mode: 'scanning' })}>
            Scan next →
          </button>
        </div>
      </div>
    );
  }

  if (state.mode === 'valid') {
    const b = bookings.find((x) => x.id === state.bookingId)!;
    const ev = eventById(b.eventId) ?? myEvents.find((e) => e.id === b.eventId);
    const remaining = b.guests.filter((g) => !g.checkedIn).length;
    return (
      <div className="scanner card-shadow">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="confirm-tick">✓</div>
          <h2>Valid ticket</h2>
          <div style={{ textAlign: 'left', margin: '18px 0' }}>
            <div className="kv">
              <span className="k">Booking</span>
              <span className="bold">{b.id}</span>
            </div>
            <div className="kv">
              <span className="k">Event</span>
              <span>{ev?.title}</span>
            </div>
            <div className="kv">
              <span className="k">Main guest</span>
              <span>
                {b.mainGuest} <span className="verified">✓</span>
              </span>
            </div>
            <div className="kv">
              <span className="k">Tickets</span>
              <span>{b.tierName}</span>
            </div>
            <div className="kv">
              <span className="k">Guests</span>
              <span>{b.guests.map((g) => g.name.split(' ')[0]).join(' · ')}</span>
            </div>
            <div className="kv" style={{ alignItems: 'center' }}>
              <span className="k">Checking in</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Stepper value={count} onChange={setCount} min={1} max={remaining} />
                <span className="muted small">of {remaining}</span>
              </span>
            </div>
          </div>
          <button
            className="btn btn-pri btn-block btn-lg"
            onClick={() => {
              const already = b.guests.filter((g) => g.checkedIn).length;
              checkInBooking(b.id, already + count);
              setCheckedInTotal((t) => t + count);
              setState({ mode: 'scanning' });
            }}
          >
            Check in {count} guest{count > 1 ? 's' : ''} ✓
          </button>
          <div className="tiny muted-2" style={{ marginTop: 10 }}>
            partial check-in supported — remaining guests can enter later
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => setState({ mode: 'scanning' })}
          >
            Scan next →
          </button>
        </div>
      </div>
    );
  }

  if (state.mode === 'invalid') {
    return (
      <div className="scanner card-shadow">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="confirm-tick" style={{ background: 'var(--danger)', color: '#fff' }}>
            ✕
          </div>
          <h2 className="danger-text">Invalid ticket</h2>
          <p className="muted small" style={{ margin: '10px 0 20px' }}>
            {state.reason}
          </p>
          <button className="btn btn-pri btn-block" onClick={() => setState({ mode: 'scanning' })}>
            Scan again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scanner card-shadow">
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px' }}>
        <Link to="/organizer/attendees" className="small muted">
          ← Exit scanner
        </Link>
        <button
          className={`small ${torch ? 'accent' : 'muted'}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          onClick={() => setTorch((t) => !t)}
        >
          🔦 torch {torch ? 'on' : ''}
        </button>
      </div>
      <div className="small muted center" style={{ paddingBottom: 8 }}>
        Indie Night Live · gate check-in
      </div>

      <div className="scan-view" style={torch ? { filter: 'brightness(1.4)' } : undefined}>
        <button
          className="scan-frame"
          style={{ background: 'none', cursor: 'pointer' }}
          onClick={simulateScan}
          title="Simulate a scan"
        >
          ⌖
        </button>
        <div className="small">align QR in frame — scanning… hold steady</div>
        <div className="tiny muted-2">(demo: tap the frame to simulate a scan)</div>
      </div>

      <div style={{ padding: 16 }}>
        <form
          className="form-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) lookup(manual);
          }}
        >
          <input
            placeholder="Enter booking #, guest name, or promoter pass"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button className="btn btn-ghost" style={{ flex: '0 0 auto' }}>
            Find
          </button>
        </form>
        <div className="small muted center" style={{ marginTop: 12 }}>
          ✓ {checkedInTotal} checked in · 412 total
        </div>
      </div>
    </div>
  );
}
