import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookings, venuePartner, promoter, type OrgAttendee, type OrgGuestListEntry, type OrgPromoterGuest } from '../../api';
import { ApiError } from '../../api/client';
import type { Booking, Event } from '../../types';
import { isPassValid } from '../../lib/promoterPass';
import CameraQRScanner from '../../components/CameraQRScanner';
import type { ReactNode } from 'react';
import { Megaphone, Star, CheckCircle2, Martini, Ticket, X, Gift, Keyboard, Camera, Check } from 'lucide-react';

type ScanState =
  | { mode: 'idle' }
  | { mode: 'checked-in'; booking: Booking }
  | { mode: 'valid-booking'; row: OrgAttendee }
  | { mode: 'valid-promoter'; row: OrgPromoterGuest }
  | { mode: 'valid-guestlist'; row: OrgGuestListEntry }
  | { mode: 'invalid'; reason: string };

type EntryMode = 'paid' | 'guestlist';

interface PaidMatch {
  main: OrgAttendee;
  matchedName: string;
  extra: number;
  disabled: boolean;
  reason?: string;
}

interface GuestListMatch {
  kind: 'promoter' | 'orgList';
  key: string;
  name: string;
  sub: ReactNode;
  disabled: boolean;
  reason?: string;
  row: OrgPromoterGuest | OrgGuestListEntry;
}

const MIN_QUERY = 2;

function paidMatches(attendees: OrgAttendee[], q: string): PaidMatch[] {
  const query = q.trim().toLowerCase();
  if (query.length < MIN_QUERY) return [];
  const byBooking = new Map<string, OrgAttendee[]>();
  for (const a of attendees) {
    if (!byBooking.has(a.bookingId)) byBooking.set(a.bookingId, []);
    byBooking.get(a.bookingId)!.push(a);
  }
  const results: PaidMatch[] = [];
  for (const rows of byBooking.values()) {
    const main = rows.find((r) => r.isMainGuest) ?? rows[0];
    const idMatch = main.bookingId.toLowerCase().includes(query);
    const nameMatch = rows.find((r) => r.name.toLowerCase().includes(query));
    if (!idMatch && !nameMatch) continue;
    const disabled = main.checkedIn || main.bookingStatus !== 'confirmed';
    const reason = main.checkedIn ? 'Already checked in' : main.bookingStatus !== 'confirmed' ? `Booking is ${main.bookingStatus}` : undefined;
    results.push({ main, matchedName: nameMatch ? nameMatch.name : main.name, extra: rows.length - 1, disabled, reason });
  }
  return results.slice(0, 8);
}

function guestListMatches(promoterGuests: OrgPromoterGuest[], orgGuests: OrgGuestListEntry[], event: Event | undefined, q: string): GuestListMatch[] {
  const query = q.trim().toLowerCase();
  if (query.length < MIN_QUERY) return [];
  const valid = event ? isPassValid(event) : false;
  const fromPromoter: GuestListMatch[] = promoterGuests
    .filter((g) => g.name.toLowerCase().includes(query))
    .map((g) => ({
      kind: 'promoter' as const,
      key: g.id,
      name: g.name,
      sub: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Megaphone size={11} /> brought by @{g.promoterSlug}</span>,
      disabled: g.arrived || !valid,
      reason: g.arrived ? 'Already checked in' : !valid ? 'Free-entry window closed' : undefined,
      row: g,
    }));
  const fromOrgList: GuestListMatch[] = orgGuests
    .filter((g) => g.name.toLowerCase().includes(query))
    .map((g) => ({
      kind: 'orgList' as const,
      key: g.id,
      name: g.name,
      sub: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Star size={11} /> guest list{g.companions.length ? <> · with {g.companions.map((c) => c.name).join(', ')}</> : null}
        </span>
      ),
      disabled: g.arrived,
      reason: g.arrived ? 'Already checked in' : undefined,
      row: g,
    }));
  return [...fromPromoter, ...fromOrgList].slice(0, 8);
}

/** Venue-hosted equivalent of organizer/Scanner.tsx. POST /bookings/check-in
 * is a shared, entity-agnostic route already — BookingsService.checkIn now
 * accepts either the owning organizer OR the owning venue (see the
 * ownership-check comment there), so this page needs no new backend route,
 * only venuePartner.* in place of organizer.* for loading event/attendee
 * data. */
export default function VenueScanner() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [attendees, setAttendees] = useState<OrgAttendee[]>([]);
  const [promoterGuests, setPromoterGuests] = useState<OrgPromoterGuest[]>([]);
  const [orgGuestList, setOrgGuestList] = useState<OrgGuestListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ScanState>({ mode: 'idle' });
  const [entryMode, setEntryMode] = useState<EntryMode>('paid');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [useCamera, setUseCamera] = useState(true);

  useEffect(() => {
    venuePartner
      .hostedEvents()
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
    Promise.all([venuePartner.attendees(eventId), venuePartner.promoterGuests(eventId), venuePartner.guestList(eventId)])
      .then(([a, p, gl]) => { setAttendees(a); setPromoterGuests(p); setOrgGuestList(gl.entries); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [eventId]);

  const event = events.find((e) => e.id === eventId);

  const onQrScanned = async (raw: string) => {
    if (busy || state.mode !== 'idle') return;
    if (entryMode === 'paid') {
      setBusy(true);
      try {
        const updated = await bookings.checkIn(raw);
        setState({ mode: 'checked-in', booking: updated });
        load();
      } catch (e) {
        setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (raw.startsWith('vip-')) {
      const entryId = raw.slice(4);
      const entry = orgGuestList.find((g) => g.id === entryId);
      if (!entry) return setState({ mode: 'invalid', reason: "Pass not recognized — make sure you're scanning the right event" });
      if (entry.arrived) return setState({ mode: 'invalid', reason: 'Already checked in' });
      return setState({ mode: 'valid-guestlist', row: entry });
    }
    const passId = raw.slice(0, raw.lastIndexOf('-'));
    const pg = promoterGuests.find((g) => g.id === passId);
    if (!pg) return setState({ mode: 'invalid', reason: "Pass not recognized — make sure you're scanning the right event" });
    if (pg.arrived) return setState({ mode: 'invalid', reason: 'Already checked in' });
    if (event && !isPassValid(event)) return setState({ mode: 'invalid', reason: 'Free-entry window has closed' });
    setState({ mode: 'valid-promoter', row: pg });
  };

  const confirmBooking = async (row: OrgAttendee) => {
    setBusy(true);
    try {
      await venuePartner.manualCheckIn(eventId, row.bookingId.replace('#', ''), 1);
      setState({ mode: 'idle' });
      setSearch('');
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
      setSearch('');
      load();
    } catch (e) {
      setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
    } finally {
      setBusy(false);
    }
  };

  const confirmGuestListEntry = async (row: OrgGuestListEntry) => {
    setBusy(true);
    try {
      await venuePartner.toggleGuestArrived(row.id);
      setState({ mode: 'idle' });
      setSearch('');
      load();
    } catch (e) {
      setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
    } finally {
      setBusy(false);
    }
  };

  const checkedInTotal = attendees.filter((a) => a.checkedIn).length + promoterGuests.filter((g) => g.arrived).length;
  const total = attendees.length + promoterGuests.length;

  const paidResults = entryMode === 'paid' ? paidMatches(attendees, search) : [];
  const guestResults = entryMode === 'guestlist' ? guestListMatches(promoterGuests, orgGuestList, event, search) : [];

  if (!loading && events.length === 0) {
    return <div className="muted small">No live hosted events yet — the scanner works once one is approved.</div>;
  }

  if (state.mode === 'checked-in') {
    const b = state.booking;
    return (
      <div className="scanner card-shadow">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="confirm-tick"><CheckCircle2 size={30} /></div>
          <h2>Checked in</h2>
          <div style={{ textAlign: 'left', margin: '18px 0' }}>
            <div className="kv"><span className="k">Booking</span><span className="bold">{b.id}</span></div>
            <div className="kv"><span className="k">Guest{b.qty > 1 ? 's' : ''}</span><span>{b.guests.map((g) => g.name).join(', ')}</span></div>
            <div className="kv"><span className="k">Tickets</span><span>{b.tierName} · {b.qty}</span></div>
            <div className="kv"><span className="k">Total paid</span><span className="bold">₹{b.total}</span></div>
            <div className="kv"><span className="k">Payment</span><span>{b.paymentId ? 'Online' : (b.paymentMethod || '—')}</span></div>
          </div>
          <div style={{ textAlign: 'left', margin: '14px 0', paddingTop: 14, borderTop: '1px dashed var(--border-dash)' }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>What's included in this ticket</div>
            {b.coverCharge ? (
              <div className="accent bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Martini size={15} /> ₹{b.coverCharge} redeemable at the venue</div>
            ) : (
              <div className="bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ticket size={15} /> Entry</div>
            )}
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
          <div className="confirm-tick"><CheckCircle2 size={30} /></div>
          <h2>Free entry — valid</h2>
          <div style={{ textAlign: 'left', margin: '18px 0' }}>
            <div className="kv"><span className="k">Guest</span><span className="bold">{g.name}</span></div>
            <div className="kv"><span className="k">Brought by</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Megaphone size={13} /> {g.promoterSlug}</span></div>
            <div className="kv"><span className="k">Age · gender</span><span>{g.age} · {g.gender}</span></div>
            <div className="kv"><span className="k">Event</span><span>{event?.title}</span></div>
          </div>
          <button className="btn btn-pri btn-block btn-lg" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={busy} onClick={() => confirmPromoter(g)}>
            {busy ? 'Checking in…' : <>Check in {g.name.split(' ')[0]} <Check size={14} /></>}
          </button>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setState({ mode: 'idle' })}>
            Scan next →
          </button>
        </div>
      </div>
    );
  }

  if (state.mode === 'valid-guestlist') {
    const g = state.row;
    const partySize = 1 + g.companions.length;
    return (
      <div className="scanner card-shadow">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="confirm-tick"><CheckCircle2 size={30} /></div>
          <h2>Guest list — valid</h2>
          <div style={{ textAlign: 'left', margin: '18px 0' }}>
            <div className="kv"><span className="k">Guest</span><span className="bold">{g.name}</span></div>
            {g.companions.length > 0 && <div className="kv"><span className="k">With</span><span>{g.companions.map((c) => c.name).join(', ')}</span></div>}
            <div className="kv"><span className="k">Party size</span><span>{partySize}</span></div>
            <div className="kv"><span className="k">Added by</span><span>{g.addedBy}</span></div>
          </div>
          <button className="btn btn-pri btn-block btn-lg" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={busy} onClick={() => confirmGuestListEntry(g)}>
            {busy ? 'Checking in…' : <>Check in {g.name.split(' ')[0]} <Check size={14} /></>}
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
    const partyNames = attendees.filter((a) => a.bookingId === row.bookingId).map((a) => a.name);
    return (
      <div className="scanner card-shadow">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="confirm-tick"><CheckCircle2 size={30} /></div>
          <h2>Valid ticket</h2>
          <div style={{ textAlign: 'left', margin: '18px 0' }}>
            <div className="kv"><span className="k">Booking</span><span className="bold">{row.bookingId}</span></div>
            <div className="kv"><span className="k">Event</span><span>{event?.title}</span></div>
            <div className="kv"><span className="k">Guest{partyNames.length > 1 ? 's' : ''}</span><span>{partyNames.join(', ') || row.name}</span></div>
            <div className="kv"><span className="k">Tickets</span><span>{row.tierName}</span></div>
            <div className="kv"><span className="k">Total paid</span><span className="bold">₹{row.total}</span></div>
            <div className="kv"><span className="k">Payment</span><span>{row.paymentMethod}</span></div>
          </div>
          <div style={{ textAlign: 'left', margin: '14px 0', paddingTop: 14, borderTop: '1px dashed var(--border-dash)' }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>What's included in this ticket</div>
            {row.coverCharge ? (
              <div className="accent bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Martini size={15} /> ₹{row.coverCharge} redeemable at the venue</div>
            ) : (
              <div className="bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ticket size={15} /> Entry</div>
            )}
          </div>
          <button className="btn btn-pri btn-block btn-lg" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={busy} onClick={() => confirmBooking(row)}>
            {busy ? 'Checking in…' : <>Check in <Check size={14} /></>}
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
          <div className="confirm-tick" style={{ background: 'var(--danger)', color: '#fff' }}><X size={30} /></div>
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
        <Link to="/venue/hosting/bookings" className="small muted">← Exit scanner</Link>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ maxWidth: 200 }}>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button type="button" className={`chip ${entryMode === 'paid' ? 'on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => { setEntryMode('paid'); setSearch(''); }}>
            <Ticket size={13} /> Paid booking
          </button>
          <button type="button" className={`chip ${entryMode === 'guestlist' ? 'on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => { setEntryMode('guestlist'); setSearch(''); }}>
            <Gift size={13} /> Guest list
          </button>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {useCamera ? (
          <>
            <CameraQRScanner onScan={onQrScanned} active={state.mode === 'idle' && !busy} />
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setUseCamera(false)}>
              <Keyboard size={14} /> Switch to manual entry
            </button>
          </>
        ) : (
          <>
            <input
              placeholder={entryMode === 'paid' ? 'Search by name or booking #' : 'Search guest name'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search.trim().length >= MIN_QUERY && (
              <div className="card" style={{ marginTop: 8, padding: 6 }}>
                {entryMode === 'paid' ? (
                  paidResults.length === 0 ? (
                    <div className="tiny muted center" style={{ padding: 10 }}>No matches</div>
                  ) : (
                    paidResults.map((r) => (
                      <button
                        key={r.main.bookingId}
                        type="button"
                        className="btn btn-ghost btn-block"
                        style={{ textAlign: 'left', opacity: r.disabled ? 0.5 : 1, display: 'block', padding: '10px 12px' }}
                        disabled={r.disabled}
                        onClick={() => setState({ mode: 'valid-booking', row: r.main })}
                      >
                        <div className="bold small">{r.main.name}{r.extra > 0 ? ` +${r.extra} more` : ''}</div>
                        <div className="tiny muted">
                          {r.matchedName !== r.main.name && `matched "${r.matchedName}" · `}
                          {r.main.bookingId} · {r.main.tierName}
                          {r.reason ? ` · ${r.reason}` : ''}
                        </div>
                      </button>
                    ))
                  )
                ) : guestResults.length === 0 ? (
                  <div className="tiny muted center" style={{ padding: 10 }}>No matches</div>
                ) : (
                  guestResults.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      className="btn btn-ghost btn-block"
                      style={{ textAlign: 'left', opacity: r.disabled ? 0.5 : 1, display: 'block', padding: '10px 12px' }}
                      disabled={r.disabled}
                      onClick={() => setState(r.kind === 'promoter' ? { mode: 'valid-promoter', row: r.row as OrgPromoterGuest } : { mode: 'valid-guestlist', row: r.row as OrgGuestListEntry })}
                    >
                      <div className="bold small">{r.name}</div>
                      <div className="tiny muted">{r.sub}{r.reason ? ` · ${r.reason}` : ''}</div>
                    </button>
                  ))
                )}
              </div>
            )}
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setUseCamera(true)}>
              <Camera size={14} /> Switch to camera scan
            </button>
          </>
        )}
        <div className="small muted center" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          {loading ? 'Loading…' : <><Check size={13} /> {checkedInTotal} checked in · {total} total</>}
        </div>
        {useCamera && (
          <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
            {entryMode === 'paid'
              ? 'camera scans check in instantly'
              : "camera scans a promoter's free-entry pass or a VIP invite QR"}
          </div>
        )}
      </div>
    </div>
  );
}
