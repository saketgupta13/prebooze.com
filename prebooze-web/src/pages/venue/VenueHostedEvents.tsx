import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, isEventOver } from '../../data/mock';
import { useApp } from '../../store/AppContext';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import type { Event, EventStatus } from '../../types';
import Poster from '../../components/Poster';
import CategoryIcon from '../../components/CategoryIcon';
import Loader from '../../components/Loader';
import { eventCity, eventPath } from '../../lib/urls';
import { AlertCircle, Check, Clock, X, Pencil, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const TABS: { key: 'all' | EventStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'draft', label: 'Drafts' },
];

const STATUS_BADGE: Record<Exclude<EventStatus, 'approved'>, { cls: string; label: string; icon?: LucideIcon }> = {
  pending: { cls: 'badge-pending', label: 'Pending review', icon: Clock },
  rejected: { cls: 'badge-danger', label: 'Rejected', icon: X },
  draft: { cls: 'badge-outline', label: 'Draft' },
};

/** Events this venue hosts itself (Event.hostedByVenue) — GET
 * /venue/hosting/events. Mirrors organizer/MyEvents.tsx, including the same
 * poster-forward card grid the public guest-facing Browse.tsx uses
 * (EventCard/.grid-4/.ecard) instead of a compact list row — a separate,
 * parallel page rather than a shared one, same reasoning as the backend's
 * duplicated saveHostedEvent (see VenueEventInput doc comment). */
export default function VenueHostedEvents() {
  const { city } = useApp();
  const [tab, setTab] = useState<'all' | EventStatus>('all');
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState('');

  useEffect(() => {
    venuePartner.hostedEvents()
      .then(setEvents)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  const deleteEvent = async (id: string) => {
    setDeletingId(id);
    setDeleteErr('');
    try {
      await venuePartner.deleteHostedEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      setDeleteErr(e instanceof ApiError ? e.message : 'Could not delete this event');
    } finally {
      setDeletingId(null);
    }
  };

  const byStatus = tab === 'all' ? events : events.filter((e) => e.status === tab);
  const list = byStatus
    .filter((e) => (scope === 'upcoming' ? !isEventOver(e) : isEventOver(e)))
    .sort((a, b) => (scope === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  if (loading) return <Loader />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ fontSize: 24 }}>Events I host</h1>
        <Link to="/venue/hosting/events/create" className="btn btn-pri">+ Create event</Link>
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

      {err && <div className="danger-text small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={14} /> {err}</div>}
      {!err && list.length === 0 && <div className="empty">No {scope} events{tab !== 'all' ? ` in ${tab}` : ''}.</div>}

      {list.length > 0 && (
        <div className="grid-4">
          {list.map((e) => {
            const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
            const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
            const badge = e.status === 'approved'
              ? (isEventOver(e) ? { cls: 'badge-outline', label: 'Approved · Ended', icon: Check } : { cls: 'badge-ok', label: 'Approved · Live', icon: Check })
              : STATUS_BADGE[e.status];
            const BadgeIcon = badge.icon;
            return (
              <div key={e.id} className="ecard" style={{ position: 'relative' }}>
                <span className={`badge ${badge.cls}`} style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{BadgeIcon && <BadgeIcon size={10} />}{badge.label}</span>
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
                    {e.organizer && <> · with {e.organizer.brandName}</>}
                  </div>
                  {e.status === 'rejected' && (
                    <Link to={`/venue/hosting/events/${e.id}/edit`} className="link tiny">fix & resubmit</Link>
                  )}
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ flex: 1 }} />
                    <Link to={`/venue/hosting/events/${e.id}/edit`} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} title="Edit — resubmits for approval"><Pencil size={12} /> Edit</Link>
                    {sold === 0 && (
                      <button className="btn btn-ghost btn-sm" title="Delete" style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => { setConfirmDeleteId(e.id); setDeleteErr(''); }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                    {e.status === 'approved' && <Link to={eventPath(eventCity(e) ?? city, e.slug)} className="icon-round" title="View as guest">⋮</Link>}
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
