import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, X, LocateFixed, Loader2, Check } from 'lucide-react';
import CityIcon from './CityIcon';
import { useApp } from '../store/AppContext';
import { EVENTS, TOP_CITIES, VENUES, ORGANIZERS, venueById } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import { toCitySlug } from '../lib/urls';

interface CityRow { name: string; icon?: string; top: boolean; events: number; venues: number; organizers: number }

/** BookMyShow-style city picker — top cities with icons, search, and geo-detect. */
export default function CityPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { city, setCity } = useApp();
  const [q, setQ] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  // Real, admin-managed city list (Admin > Locations) — icon/top/enabled and
  // a real per-city event count straight from GET /cities. Previously this
  // picker computed "coming soon" vs "N events" from the local mock EVENTS
  // array, which meant it could show a real-looking event count for a city
  // with zero real events (or "coming soon" for one that actually had
  // events) — and admin disabling a city here had zero effect on what
  // guests could actually pick, since this never read that flag at all.
  const [liveCities, setLiveCities] = useState<CityRow[] | null>(null);
  useEffect(() => {
    if (!open || !isBackendEnabled()) return;
    catalog.cities().then(setLiveCities).catch(() => setLiveCities([]));
  }, [open]);

  const mockEventCounts = useMemo(() => {
    const m = new Map<string, number>();
    EVENTS.filter((e) => e.status === 'approved').forEach((e) => {
      const c = (e.venueId ? venueById(e.venueId)?.city : e.privateCity) ?? undefined;
      if (c) m.set(c, (m.get(c) ?? 0) + 1);
    });
    return m;
  }, []);
  const mockVenueCounts = useMemo(() => {
    const m = new Map<string, number>();
    VENUES.forEach((v) => m.set(v.city, (m.get(v.city) ?? 0) + 1));
    return m;
  }, []);
  const mockOrganizerCounts = useMemo(() => {
    const m = new Map<string, number>();
    ORGANIZERS.forEach((o) => m.set(o.city, (m.get(o.city) ?? 0) + 1));
    return m;
  }, []);
  const mockRows: CityRow[] = TOP_CITIES.map((t) => ({
    name: t.name, icon: t.icon, top: true,
    events: mockEventCounts.get(t.name) ?? 0, venues: mockVenueCounts.get(t.name) ?? 0, organizers: mockOrganizerCounts.get(t.name) ?? 0,
  }));

  // Real 2026-08-29 decision: a venue or organizer alone isn't enough —
  // only cities with a real, live EVENT actually show here. A city can
  // have a real organizer or venue on file with nothing bookable yet
  // (e.g. Gurgaon — real organizer, zero events), which isn't useful to a
  // guest picking a city to book something in. Same criterion as
  // Footer.tsx's "Explore other cities" filter.
  const cityRows = (liveCities ?? (isBackendEnabled() ? [] : mockRows)).filter((c) => c.events > 0);
  const topRows = cityRows.filter((c) => c.top);
  const allCities = useMemo(() => cityRows.map((c) => c.name).sort(), [cityRows]);
  const eventCounts = useMemo(() => new Map(cityRows.map((c) => [c.name, c.events])), [cityRows]);
  const filtered = allCities.filter((c) => c.toLowerCase().includes(q.toLowerCase()));

  // Swaps the URL's city segment to match the new pick, but only when the
  // current page actually has one — CityPicker is mounted in Header, a
  // sibling of <Routes> rather than a descendant of the matched route, so
  // useParams() here would always be {} regardless of the real route;
  // checking the path's first segment against the live city list is what
  // actually answers "is this page city-scoped." A non-city-scoped page
  // (e.g. /wallet) keeps today's behavior — state-only, no navigation.
  const navigateToCity = useCallback(
    (c: string) => {
      const [first, ...rest] = location.pathname.split('/').filter(Boolean);
      const isCityScoped = first && cityRows.some((row) => toCitySlug(row.name) === first);
      if (!isCityScoped) return;
      navigate(`/${toCitySlug(c)}${rest.length ? '/' + rest.join('/') : ''}${location.search}`);
    },
    [location, navigate, cityRows]
  );

  const pick = useCallback(
    (c: string) => {
      setCity(c);
      localStorage.setItem('pb_city_manual', '1');
      setQ('');
      onClose();
      navigateToCity(c);
    },
    [setCity, onClose, navigateToCity]
  );

  // Only ever called from the "Detect my location" button below — Lighthouse
  // (rightly) flags a geolocation permission prompt firing on page load as
  // suspicious/trust-eroding, so this never triggers itself automatically,
  // on open or otherwise. The browser's own permission prompt is the gate.
  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoMsg('Location not supported on this device');
      return;
    }
    setDetecting(true);
    setGeoMsg('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`
          );
          const d = await r.json();
          const detected = (d.city || d.locality || '').trim();
          const match = allCities.find((c) => c.toLowerCase() === detected.toLowerCase());
          if (match && (eventCounts.get(match) ?? 0) > 0) {
            setCity(match);
            setGeoMsg(`Detected ${match}`);
            onClose();
            navigateToCity(match);
          } else {
            setGeoMsg(detected ? `No events in ${detected} yet — pick a city` : 'Couldn’t detect your city');
          }
        } catch {
          setGeoMsg('Couldn’t detect your city');
        }
        setDetecting(false);
      },
      () => {
        setDetecting(false);
        setGeoMsg('Location permission denied');
      },
      { timeout: 8000 }
    );
  }, [allCities, eventCounts, setCity, onClose, navigateToCity]);

  if (!open) return null;

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="citypick card card-shadow" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>Pick your city <MapPin size={18} /></h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="close"><X size={16} /></button>
        </div>

        <button className="btn btn-ghost btn-block" style={{ marginBottom: 12, borderColor: 'var(--accent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={detecting} onClick={detect}>
          {detecting ? (
            <>
              <Loader2 size={15} className="spin" /> Detecting your city…
            </>
          ) : (
            <>
              <LocateFixed size={15} /> Detect my location
            </>
          )}
        </button>
        {geoMsg && <div className="tiny muted-2 center" style={{ marginBottom: 10 }}>{geoMsg}</div>}

        <input
          placeholder="Search for your city…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', marginBottom: 14 }}
          autoFocus
        />

        {q.trim() === '' ? (
          <>
            <div className="tiny muted-2" style={{ marginBottom: 8, fontWeight: 700, letterSpacing: 0.5 }}>TOP CITIES</div>
            <div className="citypick-grid">
              {topRows.map((t) => (
                <button key={t.name} className={`citypick-cell ${t.name === city ? 'on' : ''}`} onClick={() => pick(t.name)}>
                  <span className="ic"><CityIcon city={t.name} /></span>
                  <span className="nm">{t.name}</span>
                  <span className="ct">{t.events ? `${t.events} events` : 'coming soon'}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.map((c) => (
              <button key={c} className="ss-opt" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => pick(c)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{c === city && <Check size={14} />}{c}</span>
                <span className="tiny muted-2">{eventCounts.get(c) ? `${eventCounts.get(c)} events` : 'coming soon'}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="ss-empty">No cities found for “{q}”</div>}
          </div>
        )}
      </div>
    </div>
  );
}
