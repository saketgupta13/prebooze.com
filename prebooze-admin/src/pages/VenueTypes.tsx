import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { liveVenueTypes, LiveApiError, type LiveVenueType } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Venue types';

/** Master list of venue "type" tags (Nightclub, Rooftop, Warehouse, ...) —
 * real VenueType rows, the vocabulary the venue onboarding/listing forms
 * and admin's venue editor pick from (replacing a free-text type input
 * nothing else could match against). Each row's "events" count is real —
 * how many upcoming approved events happen at a venue carrying this tag —
 * and the same list + counts power the clickable type tags on the guest
 * site's venue pages, linking to a pre-filtered /venues?type= view. */
export default function VenueTypes() {
  const session = useLiveSession();
  const { token } = session;

  const [types, setTypes] = useState<LiveVenueType[]>([]);
  const [custom, setCustom] = useState('');
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveVenueTypes.list()
      .then(setTypes)
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
      await liveVenueTypes.add(n, icon.trim() || undefined);
      setCustom('');
      setIcon('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to add');
    }
  };

  const remove = async (name: string, events: number) => {
    if (events > 0) {
      window.alert(`"${name}" is still used by ${events} upcoming event${events === 1 ? '' : 's'}' venues — remove it from those venues first.`);
      return;
    }
    if (!window.confirm(`Remove venue type "${name}"?`)) return;
    try { await liveVenueTypes.remove(name); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= types.length) return;
    const a = types[i], b = types[j];
    try {
      await Promise.all([liveVenueTypes.update(a.name, { sort: b.sort }), liveVenueTypes.update(b.name, { sort: a.sort })]);
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
        <h1 className="page-title">Venue types</h1>
        <Link to="/venues" className="btn btn-ghost btn-sm">← Venues</Link>
      </div>
      <div className="tiny hint" style={{ marginBottom: 10 }}>
        The real vocabulary venue onboarding/listing and admin's venue editor pick "type" tags from —
        each tag is also a clickable, real link on the guest site (e.g. #Nightclub → venues of that type).
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ width: 60 }}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🪩"
          />
          <input
            className="input"
            style={{ flex: 1 }}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="add a venue type…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button type="button" className="btn btn-pri btn-sm" onClick={add}>+ Add</button>
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        {types.map((t, i) => (
          <div key={t.name} className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', fontSize: 12.5 }}>
            <span style={{ flex: 1 }}>{t.icon} <b>{t.name}</b> · {t.events} event{t.events === 1 ? '' : 's'}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={i === types.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
            <span className="btn btn-danger btn-sm" style={{ padding: '2px 7px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }} onClick={() => remove(t.name, t.events)}><X size={13} /></span>
          </div>
        ))}
        {types.length === 0 && !loading && <div className="card muted small">No venue types yet.</div>}
      </div>
    </div>
  );
}
