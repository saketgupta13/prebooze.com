import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { EVENT_STATUS, SearchBox, Tag } from '../components/ui';
import type { EventStatus } from '../types';

type TabKey = 'all' | EventStatus;
const ANY = 'any';

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="chip"
      style={{
        appearance: 'none',
        cursor: 'pointer',
        background: value !== ANY ? 'var(--green)' : 'var(--bg)',
        color: value !== ANY ? 'var(--on-green)' : '#c7cbb9',
        fontWeight: value !== ANY ? 700 : 500,
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value={ANY}>{label} ▾</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export default function Events() {
  const { events, removeEvent } = useAdmin();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabKey) ?? 'all';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ANY);
  const [venue, setVenue] = useState(ANY);
  const [organizer, setOrganizer] = useState(ANY);
  const [month, setMonth] = useState(ANY);
  const [city, setCity] = useState(ANY);

  const cities = [...new Set(events.map((e) => e.city))];
  const categories = [...new Set(events.map((e) => e.category))];
  const venues = [...new Set(events.map((e) => e.venue))];
  const organizers = [...new Set(events.map((e) => e.organizer))];
  const months = [...new Set(events.map((e) => e.date.split(' ')[1]).filter(Boolean))];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: `All (${events.length})` },
    { key: 'pending', label: `Pending approval (${events.filter((e) => e.status === 'pending').length})` },
    { key: 'live', label: `Live (${events.filter((e) => e.status === 'live').length})` },
    { key: 'draft', label: `Draft (${events.filter((e) => e.status === 'draft').length})` },
  ];

  const list = useMemo(() => {
    let l = events;
    if (tab !== 'all') l = l.filter((e) => e.status === tab);
    if (category !== ANY) l = l.filter((e) => e.category === category);
    if (venue !== ANY) l = l.filter((e) => e.venue === venue);
    if (organizer !== ANY) l = l.filter((e) => e.organizer === organizer);
    if (month !== ANY) l = l.filter((e) => e.date.endsWith(' ' + month));
    if (city !== ANY) l = l.filter((e) => e.city === city);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((e) => e.title.toLowerCase().includes(q) || e.organizer.toLowerCase().includes(q));
    }
    return l;
  }, [events, tab, category, venue, organizer, month, city, query]);

  const filtersActive = category !== ANY || venue !== ANY || organizer !== ANY || month !== ANY || city !== ANY || query.trim();

  return (
    <div className="stack fade" style={{ maxWidth: 1200 }}>
      <div className="page-hd">
        <h1 className="page-title">Events</h1>
        <button className="btn btn-pri" onClick={() => navigate('/events/create')}>+ Create event</button>
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
        <FilterSelect label="Category" value={category} options={categories} onChange={setCategory} />
        <FilterSelect label="Venue" value={venue} options={venues} onChange={setVenue} />
        <FilterSelect label="Organizer" value={organizer} options={organizers} onChange={setOrganizer} />
        <FilterSelect label="Date" value={month} options={months} onChange={setMonth} />
        <FilterSelect label="City" value={city} options={cities} onChange={setCity} />
        {filtersActive && (
          <button
            className="chip"
            style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={() => {
              setCategory(ANY);
              setVenue(ANY);
              setOrganizer(ANY);
              setMonth(ANY);
              setCity(ANY);
              setQuery('');
            }}
          >
            Clear ✕
          </button>
        )}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 680 }}>
          <span style={{ flex: 2 }}>Event</span>
          <span style={{ flex: 1.2 }}>Organizer</span>
          <span style={{ flex: 1 }}>Date</span>
          <span style={{ flex: 1 }}>Sold / cap</span>
          <span style={{ flex: 0.7 }}>Comm.</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ width: 34 }} />
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
              <span style={{ width: 34, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ padding: '2px 7px' }}
                  title="Remove event"
                  onClick={(ev2) => {
                    ev2.stopPropagation();
                    if (window.confirm(`Remove "${ev.title}"? Bookings keep their records.`)) removeEvent(ev.id);
                  }}
                >
                  ✕
                </button>
              </span>
            </div>
          );
        })}
        {list.length === 0 && <div className="trow muted">No events match those filters.</div>}
      </div>
      <div className="tiny hint">
        {list.length} of {events.length} events shown · click a row to open the event editor and set its commission.
      </div>
    </div>
  );
}
