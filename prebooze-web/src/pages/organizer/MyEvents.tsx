import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { FEATURED_PRICING, fmtDate, venueById } from '../../data/mock';
import { findFeatured } from '../../lib/featured';
import { organizer } from '../../api';
import { ApiError } from '../../api/client';
import type { Event, EventStatus } from '../../types';
import { eventCity, eventPath } from '../../lib/urls';
import Poster, { categoryEmoji } from '../../components/Poster';

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

/** Real event list (GET /organizer/events) — commission is admin-set and
 * read-only (see BACKEND.md), so an honest display needs real data, not the
 * mock store. "+ Create event"/"✎ Edit" open CreateEvent.tsx, which saves via
 * the same real POST /organizer/events endpoint this list reads from. Same
 * poster-forward card grid as the public guest-facing Browse.tsx (EventCard/
 * .grid-4/.ecard), not a compact list row — a real event poster is the most
 * useful way to tell your own events apart at a glance, same as it is for a
 * guest browsing. */
export default function MyEvents() {
  const { featured, requestFeatured, toast, city } = useApp();
  const [tab, setTab] = useState<'all' | EventStatus>('all');
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    organizer
      .events()
      .then(setEvents)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  const featureEvent = (e: Event) => {
    requestFeatured({
      type: 'event',
      refId: e.id,
      city: (e.venueId ? venueById(e.venueId)?.city : e.privateCity) ?? 'Hyderabad',
      billing: 'per_event',
      amount: FEATURED_PRICING.perEvent,
      expiresAt: e.date,
    });
    toast(`Payment of ₹${FEATURED_PRICING.perEvent.toLocaleString('en-IN')} received — "${e.title}" sent for featured review ✓`);
  };

  const now = Date.now();
  const byStatus = tab === 'all' ? events : events.filter((e) => e.status === tab);
  const list = byStatus
    .filter((e) => (scope === 'upcoming' ? new Date(e.date).getTime() >= now : new Date(e.date).getTime() < now))
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
      {err && <div className="danger-text small">✕ {err}</div>}
      {!loading && !err && list.length === 0 && <div className="empty">No {scope} events{tab !== 'all' ? ` in ${tab}` : ''}.</div>}

      {list.length > 0 && (
        <div className="grid-4">
          {list.map((e) => {
            const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
            const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
            const badge = STATUS_BADGE[e.status];
            const feat = findFeatured(featured, 'event', e.id);
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
                  </div>
                  {e.status === 'rejected' && (
                    <Link to="/organizer/events/create" className="link tiny">fix & resubmit</Link>
                  )}
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {e.status === 'approved' && (
                      feat?.status === 'active' ? (
                        <span className="badge badge-accent" title={`Featured until ${fmtDate(feat.expiresAt)}`}>★ Featured</span>
                      ) : feat?.status === 'pending' ? (
                        <span className="badge badge-pending">★ Pending ◌</span>
                      ) : (
                        <button className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} title={`Feature on the home page — ₹${FEATURED_PRICING.perEvent}`} onClick={() => featureEvent(e)}>
                          ★ Feature
                        </button>
                      )
                    )}
                    <span style={{ flex: 1 }} />
                    <Link to={`/organizer/events/${e.id}/edit`} className="btn btn-ghost btn-sm" title="Edit — resubmits for approval">
                      ✎ Edit
                    </Link>
                    <Link to={eventPath(eventCity(e) ?? city, e.slug)} className="icon-round" title="View as guest">
                      ⋮
                    </Link>
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
