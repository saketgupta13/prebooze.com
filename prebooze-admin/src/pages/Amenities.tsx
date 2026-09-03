import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { liveAmenities, LiveApiError, type LiveAmenity } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Amenities';

/** Master list of venue amenity tags (Parking, Rooftop, Valet, ...) — real
 * Amenity rows, the vocabulary venue onboarding/listing and admin's venue
 * editor pick from. A custom amenity typed while editing one venue creates
 * a real row here (via AmenitiesEditor in Venues.tsx), so it's reusable on
 * every other venue instead of a one-off string on just that venue. */
export default function Amenities() {
  const session = useLiveSession();
  const { token } = session;

  const [amenities, setAmenities] = useState<LiveAmenity[]>([]);
  const [custom, setCustom] = useState('');
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveAmenities.list()
      .then(setAmenities)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const add = async () => {
    const n = custom.trim();
    if (!n) return;
    try {
      await liveAmenities.add(n, icon.trim() || undefined);
      setCustom('');
      setIcon('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to add');
    }
  };

  const remove = async (name: string, venues: number) => {
    if (venues > 0) {
      window.alert(`"${name}" is still used by ${venues} venue${venues === 1 ? '' : 's'} — remove it from those venues first.`);
      return;
    }
    if (!window.confirm(`Remove amenity "${name}"?`)) return;
    try { await liveAmenities.remove(name); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= amenities.length) return;
    const a = amenities[i], b = amenities[j];
    try {
      await Promise.all([liveAmenities.update(a.name, { sort: b.sort }), liveAmenities.update(b.name, { sort: a.sort })]);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reorder');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 620 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Amenities</h1>
        <Link to="/venues" className="btn btn-ghost btn-sm">← Venues</Link>
      </div>
      <div className="tiny hint" style={{ marginBottom: 10 }}>
        The real vocabulary venue onboarding/listing and admin's venue editor pick amenity tags from —
        adding a custom amenity while editing a venue creates a row here too, so it's reusable everywhere.
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ width: 60 }}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🅿️"
          />
          <input
            className="input"
            style={{ flex: 1 }}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="add an amenity…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button type="button" className="btn btn-pri btn-sm" onClick={add}>+ Add</button>
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        {amenities.map((a, i) => (
          <div key={a.name} className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', fontSize: 12.5 }}>
            <span style={{ flex: 1 }}>{a.icon} <b>{a.name}</b> · {a.venues} venue{a.venues === 1 ? '' : 's'}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={i === amenities.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
            <span className="btn btn-danger btn-sm" style={{ padding: '2px 7px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }} onClick={() => remove(a.name, a.venues)}><X size={13} /></span>
          </div>
        ))}
        {amenities.length === 0 && !loading && <div className="card muted small">No amenities yet.</div>}
      </div>
    </div>
  );
}
