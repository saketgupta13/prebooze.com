import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CATEGORY_TREE, EVENTS, venueById } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Event } from '../types';
import { featuredRefs, featuredFirst } from '../lib/featured';
import EventCard from '../components/EventCard';
import { useSeo } from '../lib/useSeo';

const DATE_FILTERS = ['Any date', 'This weekend', 'This month'];
const SORTS = ['sorted by date', 'price low→high', 'price high→low'];
const SORT_PARAM: Record<string, string | undefined> = { [SORTS[0]]: undefined, [SORTS[1]]: 'price_asc', [SORTS[2]]: 'price_desc' };

/** Real bug fixed (2026-10-19): the old price filter was 3 hardcoded
 * buckets (Under ₹30 / ₹30–₹80 / ₹80+) that made no sense once ticket
 * prices moved outside that range — a city where everything starts at
 * ₹500 made every bucket either empty or useless. Instead, band edges are
 * derived from the real min/max price actually on screen right now: the
 * range is split into 3 equal-width bands (average difference between
 * edges), so the three options always roughly three-way-split whatever's
 * actually bookable. Rounded to a clean ₹10 so labels read as real prices,
 * not a raw division artifact like "₹173". */
function priceBands(prices: number[]): { label: string; test: (p: number) => boolean }[] | null {
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return null; // nothing to band — every event is the same price
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const low = round10(min + (max - min) / 3);
  const high = round10(min + (2 * (max - min)) / 3);
  if (low === min || high === low) return null; // range too narrow to produce 3 distinct bands
  return [
    { label: `Under ₹${low}`, test: (p) => p < low },
    { label: `₹${low}–₹${high}`, test: (p) => p >= low && p <= high },
    { label: `₹${high}+`, test: (p) => p > high },
  ];
}

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
  const [priceIdx, setPriceIdx] = useState(0); // 0 = "Price" (no filter), else 1-indexed into bands
  const [sort, setSort] = useState(SORTS[0]);

  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog
      .events({ city, cat: cat === 'Category' ? undefined : cat, sub: sub || undefined, search: q || undefined, sort: SORT_PARAM[sort] })
      .then(setLiveEvents)
      .catch(() => setLiveEvents([]));
  }, [city, cat, sub, q, sort]);
  const eventsLoading = isBackendEnabled() && liveEvents === null;

  const [liveCategories, setLiveCategories] = useState<{ name: string; icon: string; subs: string[] }[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.categories().then(setLiveCategories).catch(() => setLiveCategories([]));
  }, []);
  const categories = liveCategories ?? (isBackendEnabled() ? [] : CATEGORY_TREE);
  const CATS = ['Category', ...categories.map((c) => c.name)];
  const subsFor = (name: string) => categories.find((c) => c.name === name)?.subs ?? [];

  const events = useMemo(() => {
    let list: Event[];
    if (liveEvents) {
      list = liveEvents;
    } else if (isBackendEnabled()) {
      // still loading — an empty grid for a moment beats a flash of
      // mock events (wrong city/category/data) before the real GET
      // /events response replaces it.
      list = [];
    } else {
      list = EVENTS.filter((e) => e.status === 'approved' && (e.venueId ? venueById(e.venueId).city : e.privateCity) === city);
      if (q)
        list = list.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.venueId ? venueById(e.venueId).name : e.privateLocality ?? '').toLowerCase().includes(q) ||
            e.lineup.some((l) => l.name.toLowerCase().includes(q))
        );
      if (cat !== 'Category') list = list.filter((e) => e.category === cat);
      if (sub) list = list.filter((e) => e.subCategory === sub);
    }
    if (dateF === 'This weekend') {
      list = list.filter((e) => [0, 5, 6].includes(new Date(e.date).getDay()));
    }
    // Bands computed from this exact list (post date/category/search, pre
    // price) — the same set the dropdown's band labels below are built
    // from, so "Under ₹X" always matches what's actually filtered here.
    const bands = priceBands(list.map((e) => Math.min(...e.tiers.map((t) => t.price))));
    if (bands && priceIdx > 0) {
      const band = bands[priceIdx - 1];
      if (band) list = list.filter((e) => band.test(Math.min(...e.tiers.map((t) => t.price))));
    }
    if (!liveEvents) {
      // server already sorts real results; mock fallback still needs local sorting
      if (sort === SORTS[0]) list = [...list].sort((a, b) => a.date.localeCompare(b.date));
      if (sort === SORTS[1]) list = [...list].sort((a, b) => Math.min(...a.tiers.map((t) => t.price)) - Math.min(...b.tiers.map((t) => t.price)));
      if (sort === SORTS[2]) list = [...list].sort((a, b) => Math.min(...b.tiers.map((t) => t.price)) - Math.min(...a.tiers.map((t) => t.price)));
    }
    return featuredFirst(list, (e) => e.id, featuredRefs(featured, 'event', city));
  }, [liveEvents, q, cat, sub, priceIdx, dateF, sort, city, featured]);

  // Same band computation, reused by the dropdown render below so its
  // option labels always match what `events` above just filtered by —
  // computed from the pre-price-filter list (liveEvents or the mock
  // equivalent), not the already-price-filtered `events` result.
  const priceBandOptions = useMemo(() => {
    const source = liveEvents ?? (isBackendEnabled() ? [] : EVENTS.filter((e) => e.status === 'approved' && (e.venueId ? venueById(e.venueId).city : e.privateCity) === city));
    return priceBands(source.map((e) => Math.min(...e.tiers.map((t) => t.price))));
  }, [liveEvents, city]);

  // sub-category counts within the selected city + category
  const subCounts = useMemo(() => {
    if (cat === 'Category') return new Map<string, number>();
    const m = new Map<string, number>();
    const source = liveEvents ?? (isBackendEnabled() ? [] : EVENTS.filter((e) => e.status === 'approved' && (e.venueId ? venueById(e.venueId).city : e.privateCity) === city));
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
          {priceBandOptions && (
            <select value={priceIdx} onChange={(e) => setPriceIdx(Number(e.target.value))} style={{ width: 'auto' }}>
              <option value={0}>Price</option>
              {priceBandOptions.map((b, i) => <option key={b.label} value={i + 1}>{b.label}</option>)}
            </select>
          )}
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
                {s} ({eventsLoading ? '…' : subCounts.get(s) ?? 0})
              </button>
            ))}
          </div>
        )}

        <h1 style={{ fontSize: 21, marginBottom: 18 }}>
          {eventsLoading ? 'Loading…' : <>{events.length} event{events.length === 1 ? '' : 's'} in <span className="accent">{city}</span></>}
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
        ) : !eventsLoading ? (
          <div className="empty">No events match those filters — try clearing one.</div>
        ) : null}
      </div>
    </main>
  );
}
