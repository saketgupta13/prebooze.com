import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { fmtDate, isEventOver } from '../../data/mock';
import { organizer, featured as featuredApi } from '../../api';
import { ApiError } from '../../api/client';
import type { Event, EventStatus, Featured } from '../../types';
import { eventCity, eventPath } from '../../lib/urls';
import Poster from '../../components/Poster';
import CategoryIcon from '../../components/CategoryIcon';
import { CheckCircle2, X, Star, Pencil, Trash2, MapPin } from 'lucide-react';

const TABS: { key: 'all' | EventStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'draft', label: 'Drafts' },
];

// 'approved' is a function, not a static entry — the same event stays
// "Approved" forever, but whether it's actually still Live depends on
// whether it's already happened (date + durationHrs), same isEventOver
// check already used by Bookings.tsx/Dashboard.tsx/Scanner.tsx. Without
// this, a past-dated approved event showed "Live" weeks after it ended.
const STATUS_BADGE: Record<Exclude<EventStatus, 'approved'>, { cls: string; label: ReactNode }> = {
  pending: { cls: 'badge-pending', label: 'Pending review ◌' },
  rejected: { cls: 'badge-danger', label: <>Rejected <X size={11} /></> },
  draft: { cls: 'badge-outline', label: 'Draft' },
};
const approvedBadge = (e: Event) => ({
  cls: 'badge-ok',
  label: isEventOver(e) ? <>Approved <CheckCircle2 size={11} /> · Ended</> : <>Approved <CheckCircle2 size={11} /> · Live</>,
});

/** Real event list (GET /organizer/events) — commission is admin-set and
 * read-only (see BACKEND.md), so an honest display needs real data, not the
 * mock store. "+ Create event"/"✎ Edit" open CreateEvent.tsx, which saves via
 * the same real POST /organizer/events endpoint this list reads from. Same
 * poster-forward card grid as the public guest-facing Browse.tsx (EventCard/
 * .grid-4/.ecard), not a compact list row — a real event poster is the most
 * useful way to tell your own events apart at a glance, same as it is for a
 * guest browsing. */
export default function MyEvents() {
  const { toast, city } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'all' | EventStatus>('all');
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState('');
  // Real Featured status per event id (GET /featured/mine) — replaces the
  // old mock-store lookup entirely; see featureEvent's own doc comment for
  // the real payment flow this now drives.
  const [featuredMap, setFeaturedMap] = useState<Record<string, Featured | null>>({});
  const [featuring, setFeaturing] = useState<string | null>(null);
  const [resendingLocationId, setResendingLocationId] = useState<string | null>(null);
  const [resentLocationId, setResentLocationId] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    featuredApi.rates().then((r) => setRate(r.perEvent)).catch(() => {});
  }, []);

  useEffect(() => {
    organizer
      .events()
      .then(setEvents)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const approved = events.filter((e) => e.status === 'approved');
    if (approved.length === 0) return;
    Promise.all(approved.map((e) => featuredApi.mine('event', e.id).then((f) => [e.id, f] as const).catch(() => [e.id, null] as const)))
      .then((pairs) => setFeaturedMap(Object.fromEntries(pairs)));
  }, [events]);

  // Real PhonePe return handler — mirrors Checkout.tsx's own resume
  // pattern (useLayoutEffect so a bfcache-restored instance never shows a
  // stale frame first), just much simpler: no attendee form/hold state to
  // rebuild, only "did this one payment go through."
  const featuredIdReturn = searchParams.get('phonepe_return') === '1' ? searchParams.get('featuredId') : null;
  const confirmedRef = useRef<Set<string>>(new Set());
  useLayoutEffect(() => {
    if (!featuredIdReturn || confirmedRef.current.has(featuredIdReturn)) return;
    confirmedRef.current.add(featuredIdReturn);
    let attempt = 0;
    const check = async () => {
      try {
        const row = await featuredApi.confirmPayment(featuredIdReturn);
        setFeaturedMap((prev) => ({ ...prev, [row.refId]: row }));
        toast('Payment received — sent for featured review ✓');
        setSearchParams((p) => { p.delete('phonepe_return'); p.delete('featuredId'); return p; }, { replace: true });
        return;
      } catch {
        // keep retrying briefly — PhonePe's own webhook/status can lag a
        // couple seconds behind the guest's redirect back here
      }
      attempt += 1;
      if (attempt >= 5) {
        toast("Still confirming your payment — check back in a minute, or contact support if it doesn't show as featured.");
        setSearchParams((p) => { p.delete('phonepe_return'); p.delete('featuredId'); return p; }, { replace: true });
        return;
      }
      setTimeout(check, 2000);
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredIdReturn]);

  const deleteEvent = async (id: string) => {
    setDeletingId(id);
    setDeleteErr('');
    try {
      await organizer.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      setDeleteErr(e instanceof ApiError ? e.message : 'Could not delete this event');
    } finally {
      setDeletingId(null);
    }
  };

  /** Real bug fixed 2026-09-25: this used to be a pure client-side mock —
   * it wrote a fake "active" Featured row into local AppContext state and
   * showed "Payment of ₹2,000 received ✓" without ever charging anything
   * or persisting it anywhere. A real, already-working PhonePe-backed
   * Featured backend existed the whole time (FeaturedService.request/
   * confirmPayment) — MyEvents.tsx's button was just never wired to it.
   * Redirects to a real PhonePe order; confirmation happens in the
   * useLayoutEffect above once PhonePe sends the guest back here. */
  const featureEvent = async (e: Event) => {
    setFeaturing(e.id);
    try {
      const row = await featuredApi.request({ type: 'event', refId: e.id, billing: 'per_event' });
      window.location.href = row.phonepeRedirectUrl;
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not start the featured payment — try again in a moment');
      setFeaturing(null);
    }
  };

  const resendLocation = async (eventId: string) => {
    setResendingLocationId(eventId);
    try {
      await organizer.resendEventLocation(eventId);
      setResentLocationId(eventId);
      setTimeout(() => setResentLocationId(null), 2500);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not resend the location — try again in a moment');
    } finally {
      setResendingLocationId(null);
    }
  };

  const byStatus = tab === 'all' ? events : events.filter((e) => e.status === tab);
  const list = byStatus
    .filter((e) => (scope === 'upcoming' ? !isEventOver(e) : isEventOver(e)))
    .sort((a, b) => (scope === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ fontSize: 24 }}>My events</h1>
        <Link to="/organizer/events/create" className="btn btn-pri">
          + Create event
        </Link>
      </div>

      <div className="tabs">
        {TABS.map((t) => {
          const count = t.key === 'all' ? events.length : events.filter((e) => e.status === t.key).length;
          return (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
              {t.label} ({count})
            </button>
          );
        })}
      </div>
      <div className="tabs" style={{ marginBottom: 18 }}>
        <button className={scope === 'upcoming' ? 'on' : ''} onClick={() => setScope('upcoming')}>Upcoming</button>
        <button className={scope === 'past' ? 'on' : ''} onClick={() => setScope('past')}>Past</button>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {err && <div className="danger-text small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}
      {!loading && !err && list.length === 0 && <div className="empty">No {scope} events{tab !== 'all' ? ` in ${tab}` : ''}.</div>}

      {list.length > 0 && (
        <div className="grid-4">
          {list.map((e) => {
            const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
            const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
            const badge = e.status === 'approved' ? approvedBadge(e) : STATUS_BADGE[e.status];
            const feat = featuredMap[e.id];
            return (
              <div key={e.id} className="ecard" style={{ position: 'relative' }}>
                <span className={`badge ${badge.cls}`} style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{badge.label}</span>
                <Poster hue={e.posterHue} icon={<CategoryIcon name={e.category} />} imageUrl={e.posterUrl} alt={e.title} />
                <div className="ecard-body">
                  <h3>{e.title}</h3>
                  <div className="meta">
                    {e.status === 'rejected' ? (
                      <>reason: {e.rejectionReason ?? 'guideline issue'}</>
                    ) : e.status === 'draft' ? (
                      'draft · last edited recently'
                    ) : e.status === 'pending' ? (
                      `${fmtDate(e.date)} · submitted for review`
                    ) : (
                      `${fmtDate(e.date)} · ${sold.toLocaleString()}/${cap.toLocaleString()} sold`
                    )}
                  </div>
                  {e.status === 'rejected' && (
                    <Link to={`/organizer/events/${e.id}/edit`} className="link tiny">fix & resubmit</Link>
                  )}
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {e.status === 'approved' && (
                      feat?.status === 'active' ? (
                        <span className="badge badge-accent" title={`Featured until ${fmtDate(feat.expiresAt)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Star size={11} /> Featured</span>
                      ) : feat?.status === 'pending' ? (
                        <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Star size={11} /> Pending ◌</span>
                      ) : feat?.status === 'rejected' ? (
                        <button className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 5 }} disabled={featuring === e.id} title={rate ? `Feature on the home page — ₹${rate}` : 'Feature on the home page'} onClick={() => featureEvent(e)}>
                          <Star size={13} /> {featuring === e.id ? 'Starting…' : 'Feature again'}
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 5 }} disabled={featuring === e.id} title={rate ? `Feature on the home page — ₹${rate}` : 'Feature on the home page'} onClick={() => featureEvent(e)}>
                          <Star size={13} /> {featuring === e.id ? 'Starting…' : 'Feature'}
                        </button>
                      )
                    )}
                    {e.status === 'approved' && e.exactAddress && !isEventOver(e) && (
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Resend the address + map link to every confirmed guest right now"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        disabled={resendingLocationId === e.id}
                        onClick={() => resendLocation(e.id)}
                      >
                        <MapPin size={13} /> {resendingLocationId === e.id ? 'Sending…' : resentLocationId === e.id ? 'Sent' : 'Resend location'}
                      </button>
                    )}
                    <span style={{ flex: 1 }} />
                    <Link to={`/organizer/events/${e.id}/edit`} className="btn btn-ghost btn-sm" title="Edit — resubmits for approval" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Pencil size={13} /> Edit
                    </Link>
                    {sold === 0 && (
                      <button className="btn btn-ghost btn-sm" title="Delete" style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => { setConfirmDeleteId(e.id); setDeleteErr(''); }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                    <Link to={eventPath(eventCity(e) ?? city, e.slug)} className="icon-round" title="View as guest">
                      ⋮
                    </Link>
                  </div>
                  {confirmDeleteId === e.id && (
                    <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 10, marginTop: 8 }}>
                      {deleteErr && <div className="danger-text tiny" style={{ marginBottom: 6 }}>{deleteErr}</div>}
                      <div className="tiny muted-2" style={{ marginBottom: 8 }}>Delete "{e.title}" permanently? This can't be undone.</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-danger btn-sm" disabled={deletingId === e.id} onClick={() => deleteEvent(e.id)}>
                          {deletingId === e.id ? 'Deleting…' : 'Yes, delete'}
                        </button>
                        <button className="btn btn-ghost btn-sm" disabled={deletingId === e.id} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
