import { useEffect, useState } from 'react';
import { liveLocations, LiveApiError, type LiveCountry } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Locations (live)';

/** Real country → state → city tree. Adding/toggling a city is the actual
 * real action worth having (it's what drives the guest site's city picker
 * and event filters) — adding new countries/states is rare and stays on
 * the mock page for now. */
export default function LocationsLive() {
  const session = useLiveSession();
  const { token } = session;
  const [tree, setTree] = useState<LiveCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [stateId, setStateId] = useState('');
  const [cityName, setCityName] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveLocations
      .tree()
      .then((t) => {
        setTree(t);
        const firstState = t.flatMap((c) => c.states)[0];
        if (firstState && !stateId) setStateId(firstState.id);
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

  const addCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stateId || !cityName.trim()) return;
    try {
      await liveLocations.addCity(stateId, cityName.trim());
      setCityName('');
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add city');
    }
  };

  const toggleCity = async (name: string) => {
    try {
      await liveLocations.toggleCity(name);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const allStates = tree.flatMap((c) => c.states.map((s) => ({ ...s, countryName: c.name })));

  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={addCity}>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>State</label>
          <select className="input" value={stateId} onChange={(e) => setStateId(e.target.value)}>
            {allStates.map((s) => <option key={s.id} value={s.id}>{s.countryName} / {s.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>New city</label>
          <input className="input" value={cityName} onChange={(e) => setCityName(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-pri">+ Add city</button>
      </form>

      {tree.map((country) => (
        <div key={country.id} className="tblwrap">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', fontWeight: 700 }}>{country.name}</div>
          {country.states.map((state) => (
            <div key={state.id}>
              <div className="trow muted tiny" style={{ paddingLeft: 16 }}>{state.name}</div>
              {state.cities.map((city) => (
                <div key={city.name} className="trow" style={{ paddingLeft: 32 }}>
                  <span style={{ flex: 1 }}>{city.icon} {city.name}</span>
                  <span style={{ flex: 0.6, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleCity(city.name)}>{city.top ? 'Top city ✓' : 'Not top'}</button>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
