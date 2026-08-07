import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../../data/mock';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import type { Event, EventStatus } from '../../types';
import { categoryEmoji } from '../../components/Poster';
import Loader from '../../components/Loader';

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
 * /venue/hosting/events. Mirrors organizer/MyEvents.tsx; a separate,
 * parallel page rather than a shared one, same reasoning as the backend's
 * duplicated saveHostedEvent (see VenueEventInput doc comment) — nothing
 * here touches the organizer's own event list or its code path. */
export default function VenueHostedEvents() {
  const [tab, setTab] = useState<'all' | EventStatus>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    venuePartner.hostedEvents()
      .then(setEvents)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  const list = tab === 'all' ? events : events.filter((e) => e.status === tab);

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

      <div className="card">
        {err && <div className="danger-text small">✕ {err}</div>}
        {!err && list.length === 0 && <div className="empty">Nothing here yet.</div>}
        {list.map((e) => {
          const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
          const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
          const badge = STATUS_BADGE[e.status];
          return (
            <div key={e.id} className="evrow">
              <div
                className="thumb"
                style={{ background: `radial-gradient(ellipse at 30% 25%, hsla(${e.posterHue},70%,55%,.3), transparent 60%), var(--surface-2)` }}
              >
                {categoryEmoji(e.category)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bold small">{e.title}</div>
                <div className="tiny muted">
                  {e.status === 'rejected' ? (
                    <>reason: {e.rejectionReason ?? 'guideline issue'} · <Link to={`/venue/hosting/events/${e.id}/edit`} className="link">fix & resubmit</Link></>
                  ) : e.status === 'draft' ? (
                    'draft · last edited recently'
                  ) : e.status === 'pending' ? (
                    `${fmtDate(e.date)} · submitted for review`
                  ) : (
                    `${fmtDate(e.date)} · ${sold.toLocaleString()}/${cap.toLocaleString()} sold`
                  )}
                  {e.organizer && <> · with {e.organizer.brandName}</>}
                </div>
              </div>
              <span className={`badge ${badge.cls}`}>{badge.label}</span>
              <Link to={`/venue/hosting/events/${e.id}/edit`} className="btn btn-ghost btn-sm" title="Edit — resubmits for approval">✎ Edit</Link>
              {e.status === 'approved' && <Link to={`/events/${e.slug}`} className="icon-round" title="View as guest">⋮</Link>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
