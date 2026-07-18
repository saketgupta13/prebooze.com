import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { EVENTS, TOP_CITIES, venueById } from '../data/mock';

/** BookMyShow-style city picker — top cities with icons, search, and geo-detect. */
export default function CityPicker({ open, onClose, autoDetect = false }: { open: boolean; onClose: () => void; autoDetect?: boolean }) {
  const { city, setCity } = useApp();
  const [q, setQ] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');

  const eventCounts = useMemo(() => {
    const m = new Map<string, number>();
    EVENTS.filter((e) => e.status === 'approved').forEach((e) => {
      const c = venueById(e.venueId)?.city;
      if (c) m.set(c, (m.get(c) ?? 0) + 1);
    });
    return m;
  }, []);

  const allCities = useMemo(
    () => Array.from(new Set([...eventCounts.keys(), ...TOP_CITIES.map((t) => t.name)])).sort(),
    [eventCounts]
  );
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

  const detect = useCallback(
    (auto = false) => {
      if (!navigator.geolocation) {
        if (!auto) setGeoMsg('Location not supported on this device');
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
          if (!auto) setGeoMsg('Location permission denied');
        },
        { timeout: 8000 }
      );
    },
    [allCities, eventCounts, setCity, onClose]
  );

  // auto-detect once when opened for the first visit
  useEffect(() => {
    if (open && autoDetect) detect(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoDetect]);

  if (!open) return null;

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="citypick card card-shadow" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 20 }}>Pick your city 📍</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="close">✕</button>
        </div>

        <button className="btn btn-ghost btn-block" style={{ marginBottom: 12, borderColor: 'var(--accent)', color: 'var(--accent)' }} disabled={detecting} onClick={() => detect(false)}>
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
              {TOP_CITIES.map((t) => (
                <button key={t.name} className={`citypick-cell ${t.name === city ? 'on' : ''}`} onClick={() => pick(t.name)}>
                  <span className="ic">{t.icon}</span>
                  <span className="nm">{t.name}</span>
                  <span className="ct">{eventCounts.get(t.name) ? `${eventCounts.get(t.name)} events` : 'coming soon'}</span>
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
