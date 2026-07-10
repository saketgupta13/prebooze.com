import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { eventById } from '../../data/mock';
import Stepper from '../../components/Stepper';

type ScanState =
  | { mode: 'scanning' }
  | { mode: 'valid'; bookingId: string }
  | { mode: 'invalid'; reason: string };

export default function Scanner() {
  const { bookings, checkInBooking, myEvents } = useApp();
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

  const lookup = (idRaw: string) => {
    const b = findBooking(idRaw);
    if (!b) return setState({ mode: 'invalid', reason: 'Booking number not found for this event' });
    if (b.status !== 'confirmed')
      return setState({ mode: 'invalid', reason: 'Booking was cancelled / refunded' });
    if (b.guests.every((g) => g.checkedIn))
      return setState({ mode: 'invalid', reason: 'QR already used — all guests checked in' });
    setCount(b.guests.filter((g) => !g.checkedIn).length);
    setState({ mode: 'valid', bookingId: b.id });
  };

  const simulateScan = () => {
    const candidate = bookings.find(
      (b) => b.status === 'confirmed' && b.guests.some((g) => !g.checkedIn)
    );
    if (candidate) lookup(candidate.id);
    else setState({ mode: 'invalid', reason: 'No un-scanned bookings in this browser — make a booking first, or enter a booking # manually' });
  };

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
            placeholder="Enter booking # manually (e.g. TKT-88412)"
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
