import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CATEGORY_TREE, EVENTS, subsFor, venueById } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Event } from '../types';
import { featuredRefs, featuredFirst } from '../lib/featured';
import EventCard from '../components/EventCard';
import { useSeo } from '../lib/useSeo';

const DATE_FILTERS = ['Any date', 'This weekend', 'This month'];
const CATS = ['Category', ...CATEGORY_TREE.map((c) => c.name)];
const PRICES = ['Price', 'Under ₹30', '₹30–₹80', '₹80+'];
const SORTS = ['sorted by date', 'price low→high', 'price high→low'];
const SORT_PARAM: Record<string, string | undefined> = { [SORTS[0]]: undefined, [SORTS[1]]: 'price_asc', [SORTS[2]]: 'price_desc' };

/** Real event search — server does city/category/sub-category/search/sort
 * (GET /events already supports all of these); price band and "this
 * weekend" stay client-side post-filters since the API doesn't take them. */
export default function Browse() {
  useSeo(null, 'Browse events');
  const { city, featured } = useApp();
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').toLowerCase();
  const [dateF, setDateF] = useState(DATE_FILTERS[0]);
  const [cat, setCat] = useState(params.get('cat') ?? 'Category');
  const [sub, setSub] = useState(params.get('sub') ?? '');
  const [price, setPrice] = useState(PRICES[0]);
  const [sort, setSort] = useState(SORTS[0]);

  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog
      .events({ city, cat: cat === 'Category' ? undefined : cat, sub: sub || undefined, search: q || undefined, sort: SORT_PARAM[sort] })
      .then(setLiveEvents)
      .catch(() => setLiveEvents([]));
  }, [city, cat, sub, q, sort]);

  const events = useMemo(() => {
    let list: Event[];
    if (liveEvents) {
      list = liveEvents;
    } else {
      list = EVENTS.filter((e) => e.status === 'approved' && venueById(e.venueId).city === city);
      if (q)
        list = list.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            venueById(e.venueId).name.toLowerCase().includes(q) ||
            e.lineup.some((l) => l.name.toLowerCase().includes(q))
        );
      if (cat !== 'Category') list = list.filter((e) => e.category === cat);
      if (sub) list = list.filter((e) => e.subCategory === sub);
    }
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
    if (!liveEvents) {
      // server already sorts real results; mock fallback still needs local sorting
      if (sort === SORTS[0]) list = [...list].sort((a, b) => a.date.localeCompare(b.date));
      if (sort === SORTS[1]) list = [...list].sort((a, b) => Math.min(...a.tiers.map((t) => t.price)) - Math.min(...b.tiers.map((t) => t.price)));
      if (sort === SORTS[2]) list = [...list].sort((a, b) => Math.min(...b.tiers.map((t) => t.price)) - Math.min(...a.tiers.map((t) => t.price)));
    }
    return featuredFirst(list, (e) => e.id, featuredRefs(featured, 'event', city));
  }, [liveEvents, q, cat, sub, price, dateF, sort, city, featured]);

  // sub-category counts within the selected city + category
  const subCounts = useMemo(() => {
    if (cat === 'Category') return new Map<string, number>();
    const m = new Map<string, number>();
    const source = liveEvents ?? EVENTS.filter((e) => e.status === 'approved' && venueById(e.venueId).city === city);
    source.filter((e) => e.category === cat).forEach((e) => e.subCategory && m.set(e.subCategory, (m.get(e.subCategory) ?? 0) + 1));
    return m;
  }, [cat, city, liveEvents]);

  return (
    <main className="page">
      <div className="container">
        <div className="chip-row" style={{ marginBottom: 20, gap: 10, alignItems: 'center' }}>
          <span className="small muted bold">Filters:</span>
          <select value={dateF} onChange={(e) => setDateF(e.target.value)} style={{ width: 'auto' }}>
            {DATE_FILTERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={cat} onChange={(e) => { setCat(e.target.value); setSub(''); }} style={{ width: 'auto' }}>
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

        {cat !== 'Category' && subsFor(cat).length > 0 && (
          <div className="chip-row" style={{ marginBottom: 16 }}>
            <button className={`chip ${sub === '' ? 'on' : ''}`} onClick={() => setSub('')}>All {cat}</button>
            {subsFor(cat).map((s) => (
              <button key={s} className={`chip ${sub === s ? 'on' : ''}`} onClick={() => setSub(sub === s ? '' : s)}>
                {s} ({subCounts.get(s) ?? 0})
              </button>
            ))}
          </div>
        )}

        <h1 style={{ fontSize: 21, marginBottom: 18 }}>
          {events.length} event{events.length === 1 ? '' : 's'} in <span className="accent">{city}</span>
          {sub && <span className="muted" style={{ fontWeight: 500 }}> · {sub}</span>}
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
