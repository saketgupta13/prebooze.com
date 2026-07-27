import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookings, organizer, promoter, type OrgAttendee, type OrgPromoterGuest } from '../../api';
import { ApiError } from '../../api/client';
import type { Booking, Event } from '../../types';
import CameraQRScanner from '../../components/CameraQRScanner';

type ScanState =
  | { mode: 'idle' }
  | { mode: 'checked-in'; booking: Booking }
  | { mode: 'valid-booking'; row: OrgAttendee }
  | { mode: 'valid-promoter'; row: OrgPromoterGuest }
  | { mode: 'invalid'; reason: string };

/** Real gate check-in — camera scan decodes the guest's real signed-JWT QR
 * (via jsQR) and checks it in atomically through POST /bookings/check-in,
 * which now verifies the scanning organizer actually owns the ticket's
 * event (see the ownership-check comment on BookingsService.checkIn — that
 * was a real gap before this). Manual entry (booking #/name/promoter pass)
 * stays as a fallback for when the camera isn't practical. */
export default function Scanner() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [attendees, setAttendees] = useState<OrgAttendee[]>([]);
  const [promoterGuests, setPromoterGuests] = useState<OrgPromoterGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ScanState>({ mode: 'idle' });
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [useCamera, setUseCamera] = useState(true);

  useEffect(() => {
    organizer
      .events()
      .then((evs) => {
        const live = evs.filter((e) => e.status === 'approved');
        setEvents(live);
        if (live.length) setEventId(live[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const load = () => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([organizer.attendees(eventId), organizer.promoterGuests(eventId)])
      .then(([a, p]) => { setAttendees(a); setPromoterGuests(p); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [eventId]);

  const event = events.find((e) => e.id === eventId);

  const onQrScanned = async (token: string) => {
    if (busy || state.mode !== 'idle') return;
    setBusy(true);
    try {
      const updated = await bookings.checkIn(token);
      setState({ mode: 'checked-in', booking: updated });
      load();
    } catch (e) {
      setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
    } finally {
      setBusy(false);
    }
  };

  const lookup = (raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) return;
    const pg = promoterGuests.find((g) => g.id.toLowerCase() === q || g.name.toLowerCase() === q);
    if (pg) {
      if (pg.arrived) return setState({ mode: 'invalid', reason: 'This free-entry pass is already checked in' });
      return setState({ mode: 'valid-promoter', row: pg });
    }
    const norm = q.startsWith('#') ? q : '#' + q.replace(/^tkt-?/, 'tkt-');
    const row = attendees.find((a) => a.bookingId.toLowerCase() === norm || a.name.toLowerCase() === q);
    if (!row) return setState({ mode: 'invalid', reason: 'Not found — booking number or guest name unknown' });
    if (row.bookingStatus !== 'confirmed') return setState({ mode: 'invalid', reason: `Booking is ${row.bookingStatus}, not valid for entry` });
    if (row.checkedIn) return setState({ mode: 'invalid', reason: 'Already checked in' });
    setState({ mode: 'valid-booking', row });
  };

  const confirmBooking = async (row: OrgAttendee) => {
    setBusy(true);
    try {
      await organizer.manualCheckIn(eventId, row.bookingId.replace('#', ''), 1);
      setState({ mode: 'idle' });
      setManual('');
      load();
    } catch (e) {
      setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
    } finally {
      setBusy(false);
    }
  };

  const confirmPromoter = async (row: OrgPromoterGuest) => {
    setBusy(true);
    try {
      await promoter.checkInGuest(row.id);
      setState({ mode: 'idle' });
      setManual('');
      load();
    } catch (e) {
      setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
    } finally {
      setBusy(false);
    }
  };

  const checkedInTotal = attendees.filter((a) => a.checkedIn).length + promoterGuests.filter((g) => g.arrived).length;
  const total = attendees.length + promoterGuests.length;

  if (!loading && events.length === 0) {
    return <div className="muted small">No live events yet — the scanner works once an event is approved.</div>;
  }

  if (state.mode === 'checked-in') {
    const b = state.booking;
    return (
      <div className="scanner card-shadow">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="confirm-tick">✓</div>
          <h2>Checked in</h2>
          <div style={{ textAlign: 'left', margin: '18px 0' }}>
            <div className="kv"><span className="k">Booking</span><span className="bold">{b.id}</span></div>
            <div className="kv"><span className="k">Guest</span><span>{b.mainGuest}</span></div>
            <div className="kv"><span className="k">Tickets</span><span>{b.tierName} · {b.qty}</span></div>
          </div>
          <button className="btn btn-pri btn-block btn-lg" onClick={() => setState({ mode: 'idle' })}>
            Scan next →
          </button>
        </div>
      </div>
    );
  }

  if (state.mode === 'valid-promoter') {
    const g = state.row;
    return (
      <div className="scanner card-shadow">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="confirm-tick">✓</div>
          <h2>Free entry — valid</h2>
          <div style={{ textAlign: 'left', margin: '18px 0' }}>
            <div className="kv"><span className="k">Guest</span><span className="bold">{g.name}</span></div>
            <div className="kv"><span className="k">Brought by</span><span>📣 {g.promoterSlug}</span></div>
            <div className="kv"><span className="k">Age · gender</span><span>{g.age} · {g.gender}</span></div>
            <div className="kv"><span className="k">Event</span><span>{event?.title}</span></div>
          </div>
          <button className="btn btn-pri btn-block btn-lg" disabled={busy} onClick={() => confirmPromoter(g)}>
            {busy ? 'Checking in…' : `Check in ${g.name.split(' ')[0]} ✓`}
          </button>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setState({ mode: 'idle' })}>
            Scan next →
          </button>
        </div>
      </div>
    );
  }

  if (state.mode === 'valid-booking') {
    const row = state.row;
    return (
      <div className="scanner card-shadow">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="confirm-tick">✓</div>
          <h2>Valid ticket</h2>
          <div style={{ textAlign: 'left', margin: '18px 0' }}>
            <div className="kv"><span className="k">Booking</span><span className="bold">{row.bookingId}</span></div>
            <div className="kv"><span className="k">Event</span><span>{event?.title}</span></div>
            <div className="kv"><span className="k">Guest</span><span>{row.name}</span></div>
            <div className="kv"><span className="k">Tickets</span><span>{row.tierName}</span></div>
          </div>
          <button className="btn btn-pri btn-block btn-lg" disabled={busy} onClick={() => confirmBooking(row)}>
            {busy ? 'Checking in…' : 'Check in ✓'}
          </button>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setState({ mode: 'idle' })}>
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
          <div className="confirm-tick" style={{ background: 'var(--danger)', color: '#fff' }}>✕</div>
          <h2 className="danger-text">Not valid</h2>
          <p className="muted small" style={{ margin: '10px 0 20px' }}>{state.reason}</p>
          <button className="btn btn-pri btn-block" onClick={() => setState({ mode: 'idle' })}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="scanner card-shadow">
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/organizer/attendees" className="small muted">← Exit scanner</Link>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ maxWidth: 200 }}>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      <div style={{ padding: 16 }}>
        {useCamera ? (
          <>
            <CameraQRScanner onScan={onQrScanned} active={state.mode === 'idle' && !busy} />
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => setUseCamera(false)}>
              ⌨ Switch to manual entry
            </button>
          </>
        ) : (
          <>
            <form className="form-row" onSubmit={(e) => { e.preventDefault(); lookup(manual); }}>
              <input
                placeholder="Enter booking #, guest name, or promoter pass"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                autoFocus
              />
              <button className="btn btn-pri" style={{ flex: '0 0 auto' }}>Find</button>
            </form>
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => setUseCamera(true)}>
              📷 Switch to camera scan
            </button>
          </>
        )}
        <div className="small muted center" style={{ marginTop: 12 }}>
          {loading ? 'Loading…' : `✓ ${checkedInTotal} checked in · ${total} total`}
        </div>
        {useCamera && (
          <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
            camera scans check in instantly · promoter free-entry passes still need manual entry (their QR isn't ticket-linked)
          </div>
        )}
      </div>
    </div>
  );
}
