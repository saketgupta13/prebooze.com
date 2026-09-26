import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Lock, Pencil, Trash2 } from 'lucide-react';
import { liveEvents, LiveApiError, type LiveEvent } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Events';
const ANY = 'any';
// Same keys/order as prebooze-web's CreateEvent.tsx STEP_KEYS — one per
// wizard step, so a flagged key maps straight to a step the organizer sees.
const EVENT_SECTIONS: { key: string; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'media', label: 'Media' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'rules_lineup', label: 'Rules & line-up' },
  { key: 'promoters', label: 'Promoters' },
  { key: 'seo', label: 'SEO & publish' },
];
const STATUS_TABS: { key: 'all' | LiveEvent['status']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'draft', label: 'Draft' },
];

// Same formula as prebooze-api's CatalogService.isEventOver — a multi-day
// event (seriesEndDate set) only counts as past once the series itself
// ends, not right after the first day's date+durationHrs elapses.
const isPastEvent = (e: LiveEvent) => {
  if (e.seriesEndDate) return new Date(e.seriesEndDate).getTime() + 24 * 3600000 < Date.now();
  return new Date(e.date).getTime() + e.durationHrs * 3600000 < Date.now();
};

/** Real event list — merges the old mock Events.tsx (filters/search) and
 * EventsLive.tsx (real approve/reject/commission) into one real page. Real
 * delete (2026-09-25): admin god-mode, any organizer's event, still
 * blocked server-side the instant a single real Booking exists — see
 * OrganizerService.adminDeleteEvent. */
export default function EventsReal() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [tab, setTab] = useState<'all' | LiveEvent['status']>('all');
  // A pending event always needs a decision regardless of its date, so it's
  // exempt from this and shows under either scope — only approved/rejected/
  // draft (which pile up indefinitely otherwise, unlike pending) respect it.
  const [scope, setScope] = useState<'live' | 'past'>('live');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ANY);
  const [venue, setVenue] = useState(ANY);
  const [organizer, setOrganizer] = useState(ANY);
  const [city, setCity] = useState(ANY);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSections, setRejectSections] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    liveEvents.list().then(setEvents).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const inScope = (e: LiveEvent) => e.status === 'pending' || (scope === 'live' ? !isPastEvent(e) : isPastEvent(e));

  const list = useMemo(() => {
    let l = (tab === 'all' ? events : events.filter((e) => e.status === tab)).filter(inScope);
    if (category !== ANY) l = l.filter((e) => e.category === category);
    if (venue !== ANY) l = l.filter((e) => e.venue?.name === venue);
    if (organizer !== ANY) l = l.filter((e) => (e.organizer?.brandName ?? e.venue?.name ?? '') === organizer);
    if (city !== ANY) l = l.filter((e) => (e.venue?.city ?? e.privateCity) === city);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((e) => e.title.toLowerCase().includes(q) || (e.organizer?.brandName ?? e.venue?.name ?? '').toLowerCase().includes(q));
    }
    // Soonest-first when scanning what's live, most-recent-first when
    // looking back — createdAt-asc (the API's own order) puts old
    // submissions first either way, which is the opposite of useful here.
    return [...l].sort((a, b) => (scope === 'live' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tab, scope, category, venue, organizer, city, query]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const approve = async (id: string) => {
    try { await liveEvents.approve(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to approve'); }
  };
  const submitReject = async (id: string) => {
    try {
      await liveEvents.reject(id, rejectReason.trim(), [...rejectSections]);
      setRejectingId(null); setRejectReason(''); setRejectSections(new Set()); load();
    } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to reject'); }
  };
  const toggleRejectSection = (key: string) =>
    setRejectSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const saveCommission = async (id: string, value: string) => {
    const v = value.trim() === '' ? null : parseFloat(value);
    if (v != null && (Number.isNaN(v) || v < 0 || v > 100)) { setErr('Commission must be 0-100'); return; }
    try { await liveEvents.setCommission(id, v); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to save commission'); }
  };
  const deleteEvent = async (id: string) => {
    setDeletingId(id);
    try {
      await liveEvents.delete(id);
      setConfirmDeleteId(null);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  };

  const categories = [...new Set(events.map((e) => e.category))];
  const venues = [...new Set(events.map((e) => e.venue?.name).filter((n): n is string => !!n))];
  const organizers = [...new Set(events.map((e) => e.organizer?.brandName ?? e.venue?.name).filter((n): n is string => !!n))];
  const cities = [...new Set(events.map((e) => e.venue?.city ?? e.privateCity).filter((c): c is string => !!c))];

  return (
    <div className="stack fade" style={{ maxWidth: 1200 }}>
      <div className="page-hd">
        <h1 className="page-title">{TITLE}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tiny muted">signed in as {session.staffName || 'staff'}</span>
          <button className="btn btn-ghost btn-sm" onClick={session.logout}>Sign out</button>
          <button className="btn btn-pri" onClick={() => navigate('/events/create')}>+ Create event</button>
        </div>
      </div>

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {STATUS_TABS.map((t) => {
          const count = (t.key === 'all' ? events : events.filter((e) => e.status === t.key)).filter(inScope).length;
          return (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
              {t.label} ({count})
            </button>
          );
        })}
      </div>
      <div className="tabs">
        <button className={scope === 'live' ? 'on' : ''} onClick={() => setScope('live')}>Live</button>
        <button className={scope === 'past' ? 'on' : ''} onClick={() => setScope('past')}>Past</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Search events…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        {[
          { label: 'Category', value: category, options: categories, set: setCategory },
          { label: 'Venue', value: venue, options: venues, set: setVenue },
          { label: 'Organizer', value: organizer, options: organizers, set: setOrganizer },
          { label: 'City', value: city, options: cities, set: setCity },
        ].map((f) => (
          <select key={f.label} className="chip" value={f.value} onChange={(e) => f.set(e.target.value)}>
            <option value={ANY}>{f.label} ▾</option>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 780 }}>
          <span style={{ flex: 2 }}>Event</span>
          <span style={{ flex: 1.2 }}>Organizer / venue</span>
          <span style={{ flex: 1 }}>Sold / cap</span>
          <span style={{ flex: 0.9 }}>Commission</span>
          <span style={{ flex: 1.6 }}>Actions</span>
        </div>
        {list.length === 0 && !loading && <div className="trow muted">No events match those filters.</div>}
        {list.map((e) => {
          const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
          const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
          return (
            <div key={e.id} className="trow" style={{ minWidth: 780, flexWrap: 'wrap', background: e.status === 'pending' ? 'rgba(255,107,94,.06)' : undefined }}>
              <span style={{ flex: 2, cursor: 'pointer' }} onClick={() => navigate(`/events/${e.id}`)}>
                <div style={{ fontWeight: 700 }}>{e.title}</div>
                <div className="tiny muted">{e.category} · {new Date(e.date).toLocaleDateString('en-IN')} · {e.status}</div>
              </span>
              <span style={{ flex: 1.2 }} className="muted small">
                {e.organizer ? (
                  e.hostedByVenue
                    ? <>{e.organizer.brandName} · <Landmark size={11} style={{ verticalAlign: -1 }} /> with venue</>
                    : e.organizer.brandName
                ) : <><Landmark size={11} style={{ verticalAlign: -1 }} /> {e.venue?.name ?? 'venue-hosted'}</>}
                <br />
                {e.venue ? `${e.venue.name} · ${e.venue.city}` : <><Lock size={11} style={{ verticalAlign: -1 }} /> {e.privateLocality}, {e.privateCity}</>}
              </span>
              <span style={{ flex: 1 }}>{e.status === 'pending' ? '—' : `${sold}/${cap}`}</span>
              <span style={{ flex: 0.9, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  className="input"
                  style={{ width: 56, padding: '4px 6px' }}
                  defaultValue={e.commission == null ? '' : String(e.commission)}
                  placeholder="unset"
                  inputMode="numeric"
                  onBlur={(ev) => { if (ev.target.value.trim() !== (e.commission == null ? '' : String(e.commission))) saveCommission(e.id, ev.target.value); }}
                />%
              </span>
              <span style={{ flex: 1.6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {e.status === 'pending' && (
                  <>
                    <button className="btn btn-pri btn-sm" onClick={() => approve(e.id)}>Approve</button>
                    {rejectingId === e.id ? (
                      <>
                        <input className="input" style={{ width: 120, padding: '4px 6px' }} placeholder="reason" value={rejectReason} onChange={(ev) => setRejectReason(ev.target.value)} autoFocus />
                        <button className="btn btn-danger btn-sm" disabled={!rejectReason.trim()} onClick={() => submitReject(e.id)}>Confirm</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setRejectingId(null); setRejectSections(new Set()); }}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setRejectingId(e.id)}>Reject</button>
                    )}
                  </>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/events/${e.id}`)}><Pencil size={13} /> Edit</button>
                {confirmDeleteId === e.id ? (
                  <>
                    <span className="tiny muted">{sold > 0 ? `has ${sold} real booking(s)` : 'delete permanently?'}</span>
                    <button className="btn btn-danger btn-sm" disabled={deletingId === e.id} onClick={() => deleteEvent(e.id)}>{deletingId === e.id ? 'Deleting…' : 'Confirm'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmDeleteId(e.id)}><Trash2 size={13} /> Delete</button>
                )}
              </span>
              {rejectingId === e.id && (
                <div style={{ flexBasis: '100%', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                  <span className="tiny muted" style={{ width: '100%' }}>Which part is the problem? Check any that apply — the organizer's wizard will highlight those steps.</span>
                  {EVENT_SECTIONS.map((s) => (
                    <label key={s.key} className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 5, color: rejectSections.has(s.key) ? 'var(--red)' : undefined }}>
                      <input type="checkbox" checked={rejectSections.has(s.key)} onChange={() => toggleRejectSection(s.key)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="tiny hint">{list.length} of {events.length} events shown.</div>
    </div>
  );
}
