import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, venueById } from '../data/mock';
import EventCard from '../components/EventCard';

const DATE_FILTERS = ['Any date', 'This weekend', 'This month'];
const CATS = ['Category', 'Concerts', 'Comedy', 'Festivals'];
const PRICES = ['Price', 'Under ₹30', '₹30–₹80', '₹80+'];
const SORTS = ['sorted by date', 'price low→high', 'price high→low'];

export default function Browse() {
  const { city } = useApp();
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').toLowerCase();
  const [dateF, setDateF] = useState(DATE_FILTERS[0]);
  const [cat, setCat] = useState(params.get('cat') ?? 'Category');
  const [price, setPrice] = useState(PRICES[0]);
  const [sort, setSort] = useState(SORTS[0]);

  const events = useMemo(() => {
    let list = EVENTS.filter((e) => e.status === 'approved' && venueById(e.venueId).city === city);
    if (q)
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          venueById(e.venueId).name.toLowerCase().includes(q) ||
          e.lineup.some((l) => l.name.toLowerCase().includes(q))
      );
    if (cat !== 'Category') list = list.filter((e) => e.category === cat);
    if (price === PRICES[1]) list = list.filter((e) => Math.min(...e.tiers.map((t) => t.price)) < 30);
    if (price === PRICES[2])
      list = list.filter((e) => {
        const p = Math.min(...e.tiers.map((t) => t.price));
        return p >= 30 && p <= 80;
      });
    if (price === PRICES[3]) list = list.filter((e) => Math.min(...e.tiers.map((t) => t.price)) > 80);
    if (dateF === 'This weekend') {
      list = list.filter((e) => [0, 5, 6].includes(new Date(e.date).getDay()));
    }
    if (sort === SORTS[0]) list = [...list].sort((a, b) => a.date.localeCompare(b.date));
    if (sort === SORTS[1])
      list = [...list].sort(
        (a, b) => Math.min(...a.tiers.map((t) => t.price)) - Math.min(...b.tiers.map((t) => t.price))
      );
    if (sort === SORTS[2])
      list = [...list].sort(
        (a, b) => Math.min(...b.tiers.map((t) => t.price)) - Math.min(...a.tiers.map((t) => t.price))
      );
    return list;
  }, [q, cat, price, dateF, sort, city]);

  return (
    <main className="page">
      <div className="container">
        <div className="chip-row" style={{ marginBottom: 20, gap: 10, alignItems: 'center' }}>
          <span className="small muted bold">Filters:</span>
          <select value={dateF} onChange={(e) => setDateF(e.target.value)} style={{ width: 'auto' }}>
            {DATE_FILTERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 'auto' }}>
            {CATS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: 'auto' }}>
            {PRICES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <span style={{ flex: 1 }} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 'auto' }}>
            {SORTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <h1 style={{ fontSize: 21, marginBottom: 18 }}>
          {events.length} event{events.length === 1 ? '' : 's'} in <span className="accent">{city}</span>
          {q && (
            <span className="muted" style={{ fontWeight: 500 }}>
              {' '}
              for “{q}”
            </span>
          )}
        </h1>

        {events.length ? (
          <div className="grid-4">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <div className="empty">No events match those filters — try clearing one.</div>
        )}
      </div>
    </main>
  );
}
