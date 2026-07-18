import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';

/** Country → State → City manager for onboarding — add, enable/disable, remove. */
export default function Locations() {
  const { locations, addLocation, toggleLocation, removeLocation, toggleTopCity } = useAdmin();
  const topCount = locations.flatMap((c) => c.states.flatMap((st) => st.cities)).filter((ci) => ci.top).length;
  const [countryF, setCountryF] = useState(locations[0]?.name ?? '');
  const [stateF, setStateF] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newState, setNewState] = useState('');
  const [newCity, setNewCity] = useState('');

  const country = locations.find((c) => c.name === countryF);
  const state = country?.states.find((s) => s.name === stateF);

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
    <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={(e) => { e.stopPropagation(); onClick(); }}>✕</button>
  );

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <div className="page-hd">
        <h1 className="page-title">Locations</h1>
        <span className="small muted">controls the country / state / city options in onboarding</span>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'start' }}>
        {/* Countries */}
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>Countries</div>
          {locations.map((c) => (
            <div
              key={c.name}
              className={`trow clickable ${c.name === countryF ? '' : ''}`}
              style={{ background: c.name === countryF ? 'rgba(139,195,74,.08)' : undefined, opacity: c.enabled ? 1 : 0.55, gap: 6 }}
              onClick={() => { setCountryF(c.name); setStateF(''); }}
            >
              <span style={{ flex: 1, fontWeight: 700 }}>{c.name} <span className="tiny muted">({c.states.length})</span></span>
              <Toggle on={c.enabled} onClick={() => toggleLocation({ country: c.name })} />
              <Del onClick={() => { removeLocation({ country: c.name }); if (countryF === c.name) setCountryF(''); }} />
            </div>
          ))}
          <form style={{ display: 'flex', gap: 6, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); addLocation('country', {}, newCountry); setNewCountry(''); }}>
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
                  key={s.name}
                  className="trow clickable"
                  style={{ background: s.name === stateF ? 'rgba(139,195,74,.08)' : undefined, opacity: s.enabled ? 1 : 0.55, gap: 6 }}
                  onClick={() => setStateF(s.name)}
                >
                  <span style={{ flex: 1, fontWeight: 700 }}>{s.name} <span className="tiny muted">({s.cities.length})</span></span>
                  <Toggle on={s.enabled} onClick={() => toggleLocation({ country: country.name, state: s.name })} />
                  <Del onClick={() => { removeLocation({ country: country.name, state: s.name }); if (stateF === s.name) setStateF(''); }} />
                </div>
              ))}
              {country.states.length === 0 && <div className="muted small">No states yet.</div>}
              <form style={{ display: 'flex', gap: 6, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); addLocation('state', { country: country.name }, newState); setNewState(''); }}>
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
                  <span style={{ flex: 1, fontWeight: 700 }}>{ci.name}</span>
                  <button
                    className="chip"
                    title="Show as a top-city tile in the guest city picker (max 12)"
                    style={{ fontSize: 12, padding: '2px 8px', borderColor: ci.top ? 'var(--green)' : undefined }}
                    onClick={(e) => { e.stopPropagation(); toggleTopCity({ country: country!.name, state: state.name, city: ci.name }); }}
                  >
                    {ci.top ? '⭐' : '☆'}
                  </button>
                  <Toggle on={ci.enabled} onClick={() => toggleLocation({ country: country!.name, state: state.name, city: ci.name })} />
                  <Del onClick={() => removeLocation({ country: country!.name, state: state.name, city: ci.name })} />
                </div>
              ))}
              {state.cities.length === 0 && <div className="muted small">No cities yet.</div>}
              <form style={{ display: 'flex', gap: 6, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); addLocation('city', { country: country!.name, state: state.name }, newCity); setNewCity(''); }}>
                <input className="input" style={{ padding: '5px 8px' }} value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Add city" />
                <button className="btn btn-pri btn-sm">+</button>
              </form>
            </>
          )}
        </div>
      </div>
      <div className="tiny hint">disabled locations are hidden from onboarding pickers · ⭐ marks a city as a top-city tile in the guest picker popup ({topCount}/12 starred) · changes sync to the guest app when the backend lands</div>
    </div>
  );
}
