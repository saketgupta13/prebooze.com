import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { EVENT_STATUS, SearchBox, Tag } from '../components/ui';
import type { EventStatus } from '../types';

type TabKey = 'all' | EventStatus;

export default function Events() {
  const { events, toast } = useAdmin();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabKey) ?? 'all';
  const [query, setQuery] = useState('');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: `All (${events.length})` },
    { key: 'pending', label: `Pending approval (${events.filter((e) => e.status === 'pending').length})` },
    { key: 'live', label: `Live (${events.filter((e) => e.status === 'live').length})` },
    { key: 'draft', label: `Draft (${events.filter((e) => e.status === 'draft').length})` },
  ];

  const list = useMemo(() => {
    let l = events;
    if (tab !== 'all') l = l.filter((e) => e.status === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((e) => e.title.toLowerCase().includes(q) || e.organizer.toLowerCase().includes(q));
    }
    return l;
  }, [events, tab, query]);

  return (
    <div className="stack fade" style={{ maxWidth: 1200 }}>
      <div className="page-hd">
        <h1 className="page-title">Events</h1>
        <button className="btn btn-pri" onClick={() => toast('New event draft created')}>+ Create event</button>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'on' : ''}
            style={t.key === 'pending' && tab !== 'pending' ? { color: 'var(--red)' } : undefined}
            onClick={() => setParams(t.key === 'all' ? {} : { tab: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search events…" style={{ flex: 1, minWidth: 180 }} />
        <span className="chip">Category ▾</span>
        <span className="chip">Venue ▾</span>
        <span className="chip">Organizer ▾</span>
        <span className="chip">Date ▾</span>
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 680 }}>
          <span style={{ flex: 2 }}>Event</span>
          <span style={{ flex: 1.2 }}>Organizer</span>
          <span style={{ flex: 1 }}>Date</span>
          <span style={{ flex: 1 }}>Sold / cap</span>
          <span style={{ flex: 0.7 }}>Comm.</span>
          <span style={{ flex: 1 }}>Status</span>
        </div>
        {list.map((ev) => {
          const sm = EVENT_STATUS[ev.status];
          return (
            <div
              key={ev.id}
              className="trow clickable"
              style={{ minWidth: 680, background: ev.status === 'pending' ? 'rgba(255,107,94,.06)' : undefined }}
              onClick={() => navigate(`/events/${ev.id}`)}
            >
              <span style={{ flex: 2, fontWeight: 700 }}>{ev.title}</span>
              <span style={{ flex: 1.2 }} className="muted">{ev.organizer} ✓</span>
              <span style={{ flex: 1 }} className="muted">{ev.date}</span>
              <span style={{ flex: 1 }}>{ev.status === 'pending' ? '—' : `${fmt(ev.sold)}/${fmt(ev.cap)}`}</span>
              <span style={{ flex: 0.7 }} className={ev.commission == null ? 'red' : ''}>
                {ev.commission == null ? 'unset' : `${ev.commission}%`}
              </span>
              <span style={{ flex: 1 }}><Tag {...sm} /></span>
            </div>
          );
        })}
        {list.length === 0 && <div className="trow muted">No events match.</div>}
      </div>
      <div className="tiny hint">Click a row to open the event editor and set its commission.</div>
    </div>
  );
}
