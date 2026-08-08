import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { EVENTS, TOP_CITIES, venueById } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';

interface CityRow { name: string; icon?: string; top: boolean; events: number }

/** BookMyShow-style city picker — top cities with icons, search, and geo-detect. */
export default function CityPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { city, setCity } = useApp();
  const [q, setQ] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');

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
  const mockRows: CityRow[] = TOP_CITIES.map((t) => ({ name: t.name, icon: t.icon, top: true, events: mockEventCounts.get(t.name) ?? 0 }));

  const cityRows = liveCities ?? (isBackendEnabled() ? [] : mockRows);
  const topRows = cityRows.filter((c) => c.top);
  const allCities = useMemo(() => cityRows.map((c) => c.name).sort(), [cityRows]);
  const eventCounts = useMemo(() => new Map(cityRows.map((c) => [c.name, c.events])), [cityRows]);
  const filtered = allCities.filter((c) => c.toLowerCase().includes(q.toLowerCase()));

  const pick = useCallback(
    (c: string) => {
      setCity(c);
      localStorage.setItem('pb_city_manual', '1');
      setQ('');
      onClose();
    },
    [setCity, onClose]
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
            setGeoMsg(`📍 Detected ${match}`);
            onClose();
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
  }, [allCities, eventCounts, setCity, onClose]);

  if (!open) return null;

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="citypick card card-shadow" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 20 }}>Pick your city 📍</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="close">✕</button>
        </div>

        <button className="btn btn-ghost btn-block" style={{ marginBottom: 12, borderColor: 'var(--accent)', color: 'var(--accent)' }} disabled={detecting} onClick={detect}>
          {detecting ? '📡 Detecting your city…' : '📍 Detect my location'}
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
                  <span className="ic">{t.icon ?? '📍'}</span>
                  <span className="nm">{t.name}</span>
                  <span className="ct">{t.events ? `${t.events} events` : 'coming soon'}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.map((c) => (
              <button key={c} className="ss-opt" style={{ display: 'flex', justifyContent: 'space-between' }} onClick={() => pick(c)}>
                <span>{c === city ? '✓ ' : ''}{c}</span>
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
