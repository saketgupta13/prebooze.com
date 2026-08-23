import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../../data/mock';
import { useApp } from '../../store/AppContext';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import type { Event, EventStatus } from '../../types';
import Poster, { categoryEmoji } from '../../components/Poster';
import Loader from '../../components/Loader';
import { eventCity, eventPath } from '../../lib/urls';

const TABS: { key: 'all' | EventStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'draft', label: 'Drafts' },
];

const STATUS_BADGE: Record<EventStatus, { cls: string; label: string }> = {
  approved: { cls: 'badge-ok', label: 'Approved ✓ · Live' },
  pending: { cls: 'badge-pending', label: 'Pending review ◌' },
  rejected: { cls: 'badge-danger', label: 'Rejected ✕' },
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

  useEffect(() => {
    venuePartner.hostedEvents()
      .then(setEvents)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const byStatus = tab === 'all' ? events : events.filter((e) => e.status === tab);
  const list = byStatus
    .filter((e) => (scope === 'upcoming' ? new Date(e.date).getTime() >= now : new Date(e.date).getTime() < now))
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

      {err && <div className="danger-text small">✕ {err}</div>}
      {!err && list.length === 0 && <div className="empty">No {scope} events{tab !== 'all' ? ` in ${tab}` : ''}.</div>}

      {list.length > 0 && (
        <div className="grid-4">
          {list.map((e) => {
            const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
            const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
            const badge = STATUS_BADGE[e.status];
            return (
              <div key={e.id} className="ecard" style={{ position: 'relative' }}>
                <span className={`badge ${badge.cls}`} style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, fontSize: 10 }}>{badge.label}</span>
                <Poster hue={e.posterHue} emoji={categoryEmoji(e.category)} imageUrl={e.posterUrl} alt={e.title} />
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
                    <Link to={`/venue/hosting/events/${e.id}/edit`} className="btn btn-ghost btn-sm" title="Edit — resubmits for approval">✎ Edit</Link>
                    {e.status === 'approved' && <Link to={eventPath(eventCity(e) ?? city, e.slug)} className="icon-round" title="View as guest">⋮</Link>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
