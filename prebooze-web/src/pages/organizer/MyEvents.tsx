import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, fmtDate } from '../../data/mock';
import type { EventStatus } from '../../types';
import { categoryEmoji } from '../../components/Poster';

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

export default function MyEvents() {
  const { myEvents } = useApp();
  const [tab, setTab] = useState<'all' | EventStatus>('all');

  const seeded = EVENTS.filter((e) => e.organizerId === 'livewire');
  const all = [...myEvents, ...seeded];
  const list = tab === 'all' ? all : all.filter((e) => e.status === tab);

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
          const count = t.key === 'all' ? all.length : all.filter((e) => e.status === t.key).length;
          return (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="card">
        {list.length === 0 && <div className="empty">Nothing here yet.</div>}
        {list.map((e) => {
          const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
          const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
          const badge = STATUS_BADGE[e.status];
          return (
            <div key={e.id} className="evrow">
              <div
                className="thumb"
                style={{
                  background: `radial-gradient(ellipse at 30% 25%, hsla(${e.posterHue},70%,55%,.3), transparent 60%), var(--surface-2)`,
                }}
              >
                {categoryEmoji(e.category)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bold small">{e.title}</div>
                <div className="tiny muted">
                  {e.status === 'rejected' ? (
                    <>
                      reason: {e.rejectionReason ?? 'guideline issue'} ·{' '}
                      <Link to="/organizer/events/create" className="link">
                        fix & resubmit
                      </Link>
                    </>
                  ) : e.status === 'draft' ? (
                    'draft · last edited recently'
                  ) : e.status === 'pending' ? (
                    `${fmtDate(e.date)} · submitted for review`
                  ) : (
                    `${fmtDate(e.date)} · ${sold.toLocaleString()}/${cap.toLocaleString()} sold`
                  )}
                </div>
              </div>
              <span className={`badge ${badge.cls}`}>{badge.label}</span>
              <Link to={`/events/${e.slug}`} className="icon-round" title="View as guest">
                ⋮
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
