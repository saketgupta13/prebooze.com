import { useEffect, useState } from 'react';
import { X, Star } from 'lucide-react';
import { liveLocations, LiveApiError, type LiveCountry } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Locations';
const TOP_CITY_LIMIT = 12; // mirrors LocationsService's own guard, just for the hint text

/** Real country → state → city manager for onboarding — add, enable/disable,
 * remove, set a city's picker emoji, and star it as a top city. Toggling a
 * country/state cascades to everything under it (enforced server-side). */
export default function Locations() {
  const session = useLiveSession();
  const { token } = session;

  const [tree, setTree] = useState<LiveCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [countryF, setCountryF] = useState('');
  const [stateF, setStateF] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newState, setNewState] = useState('');
  const [newCity, setNewCity] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveLocations
      .tree()
      .then((t) => {
        setTree(t);
        if (!countryF && t[0]) setCountryF(t[0].name);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const country = tree.find((c) => c.name === countryF);
  const state = country?.states.find((s) => s.name === stateF);
  const topCount = tree.flatMap((c) => c.states.flatMap((st) => st.cities)).filter((ci) => ci.top).length;

  const run = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Action failed');
    }
  };

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      className={`chip ${on ? 'on' : ''}`}
      style={{ fontSize: 10.5, padding: '3px 10px', borderColor: on ? 'var(--green)' : 'var(--red)', color: on ? undefined : 'var(--red)' }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {on ? 'Enabled' : 'Disabled'}
    </button>
  );
  const Del = ({ onClick }: { onClick: () => void }) => (
    <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={(e) => { e.stopPropagation(); onClick(); }}><X size={13} /></button>
  );

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Locations</h1>
        <span className="small muted">controls the country / state / city options in onboarding</span>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'start' }}>
        {/* Countries */}
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>Countries</div>
          {tree.map((c) => (
            <div
              key={c.id}
              className="trow clickable"
              style={{ background: c.name === countryF ? 'rgba(139,195,74,.08)' : undefined, opacity: c.enabled ? 1 : 0.55, gap: 6 }}
              onClick={() => { setCountryF(c.name); setStateF(''); }}
            >
              <span style={{ flex: 1, fontWeight: 700 }}>{c.name} <span className="tiny muted">({c.states.length})</span></span>
              <Toggle on={c.enabled} onClick={() => run(() => liveLocations.toggleCountry(c.id))} />
              <Del onClick={() => { if (countryF === c.name) setCountryF(''); run(() => liveLocations.removeCountry(c.id)); }} />
            </div>
          ))}
          <form
            style={{ display: 'flex', gap: 6, marginTop: 8 }}
            onSubmit={(e) => { e.preventDefault(); if (!newCountry.trim()) return; run(() => liveLocations.addCountry(newCountry.trim())); setNewCountry(''); }}
          >
            <input className="input" style={{ padding: '5px 8px' }} value={newCountry} onChange={(e) => setNewCountry(e.target.value)} placeholder="Add country" />
            <button className="btn btn-pri btn-sm">+</button>
          </form>
        </div>

        {/* States */}
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>States {country && `· ${country.name}`}</div>
          {!country ? (
            <div className="muted small">Pick a country.</div>
          ) : (
            <>
              {country.states.map((s) => (
                <div
                  key={s.id}
                  className="trow clickable"
                  style={{ background: s.name === stateF ? 'rgba(139,195,74,.08)' : undefined, opacity: s.enabled ? 1 : 0.55, gap: 6 }}
                  onClick={() => setStateF(s.name)}
                >
                  <span style={{ flex: 1, fontWeight: 700 }}>{s.name} <span className="tiny muted">({s.cities.length})</span></span>
                  <Toggle on={s.enabled} onClick={() => run(() => liveLocations.toggleState(s.id))} />
                  <Del onClick={() => { if (stateF === s.name) setStateF(''); run(() => liveLocations.removeState(s.id)); }} />
                </div>
              ))}
              {country.states.length === 0 && <div className="muted small">No states yet.</div>}
              <form
                style={{ display: 'flex', gap: 6, marginTop: 8 }}
                onSubmit={(e) => { e.preventDefault(); if (!newState.trim()) return; run(() => liveLocations.addState(country.id, newState.trim())); setNewState(''); }}
              >
                <input className="input" style={{ padding: '5px 8px' }} value={newState} onChange={(e) => setNewState(e.target.value)} placeholder="Add state" />
                <button className="btn btn-pri btn-sm">+</button>
              </form>
            </>
          )}
        </div>

        {/* Cities */}
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>Cities {state && `· ${state.name}`}</div>
          {!state ? (
            <div className="muted small">Pick a state.</div>
          ) : (
            <>
              {state.cities.map((ci) => (
                <div key={ci.name} className="trow" style={{ opacity: ci.enabled ? 1 : 0.55, gap: 6 }}>
                  <input
                    className="input"
                    title="City icon (emoji) — shown on its tile in the guest city picker"
                    style={{ width: 44, padding: '3px 6px', textAlign: 'center', fontSize: 15 }}
                    defaultValue={ci.icon ?? ''}
                    placeholder="🏙"
                    onBlur={(e) => { if (e.target.value !== (ci.icon ?? '')) run(() => liveLocations.updateCity(ci.name, { icon: e.target.value })); }}
                  />
                  <span style={{ flex: 1, fontWeight: 700 }}>{ci.name}</span>
                  <button
                    className="chip"
                    title="Show as a top-city tile in the guest city picker (max 12)"
                    style={{ fontSize: 12, padding: '2px 8px', borderColor: ci.top ? 'var(--green)' : undefined, display: 'inline-flex', alignItems: 'center' }}
                    onClick={(e) => { e.stopPropagation(); run(() => liveLocations.updateCity(ci.name, { top: !ci.top })); }}
                  >
                    <Star size={13} fill={ci.top ? 'currentColor' : 'none'} />
                  </button>
                  <Toggle on={ci.enabled} onClick={() => run(() => liveLocations.toggleCity(ci.name))} />
                  <Del onClick={() => run(() => liveLocations.removeCity(ci.name))} />
                </div>
              ))}
              {state.cities.length === 0 && <div className="muted small">No cities yet.</div>}
              <form
                style={{ display: 'flex', gap: 6, marginTop: 8 }}
                onSubmit={(e) => { e.preventDefault(); if (!newCity.trim()) return; run(() => liveLocations.addCity(state.id, newCity.trim())); setNewCity(''); }}
              >
                <input className="input" style={{ padding: '5px 8px' }} value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Add city" />
                <button className="btn btn-pri btn-sm">+</button>
              </form>
            </>
          )}
        </div>
      </div>
      <div className="tiny hint">
        disabled locations are hidden from onboarding pickers and the guest city picker · <Star size={11} fill="currentColor" style={{ verticalAlign: -1 }} /> marks a city as a top-city tile in the guest picker popup ({topCount}/{TOP_CITY_LIMIT} starred)
      </div>
    </div>
  );
}
