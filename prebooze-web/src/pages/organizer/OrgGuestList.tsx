import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { EVENTS } from '../../data/mock';

/** Free-entry guest list — same tool the admin has, scoped to this organizer's events. */
export default function OrgGuestList() {
  const { myEvents, glist, addGlist, removeGlist, toggleGlistArrived } = useApp();
  const orgEvents = [...myEvents, ...EVENTS.filter((e) => e.organizerId === 'livewire' && !myEvents.some((m) => m.id === e.id))];
  const [eventId, setEventId] = useState(orgEvents[0]?.id ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plusOnes, setPlusOnes] = useState(0);

  const list = glist.filter((g) => g.eventId === eventId);
  const heads = list.reduce((a, g) => a + 1 + g.plusOnes, 0);
  const arrived = list.filter((g) => g.arrived).reduce((a, g) => a + 1 + g.plusOnes, 0);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addGlist({ id: 'g' + Date.now(), eventId, name: name.trim(), phone: phone.trim() || undefined, plusOnes, arrived: false });
    setName('');
    setPhone('');
    setPlusOnes(0);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>Guest list <span className="badge badge-ok">free entry</span></h1>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ maxWidth: 240 }}>
          {orgEvents.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="l">Names on list</div><div className="v">{list.length}</div></div>
        <div className="kpi"><div className="l">Total heads (incl. +1s)</div><div className="v">{heads}</div></div>
        <div className="kpi"><div className="l">Arrived</div><div className="v accent">{arrived}</div></div>
      </div>

      <form className="card" style={{ marginBottom: 16 }} onSubmit={add}>
        <div className="form-row">
          <div className="field">
            <span>Guest name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DJ Nova (artist)" />
          </div>
          <div className="field">
            <span>Phone (optional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" />
          </div>
          <div className="field" style={{ flex: '0 0 150px' }}>
            <span>Plus-ones</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlusOnes((p) => Math.max(0, p - 1))}>−</button>
              <b>+{plusOnes}</b>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlusOnes((p) => Math.min(6, p + 1))}>+</button>
            </div>
          </div>
        </div>
        <button className="btn btn-pri">Add to list ✓</button>
      </form>

      <div className="card">
        {list.length === 0 && <div className="muted small">Nobody on the list yet — add artists, press and VIPs above.</div>}
        {list.map((g) => (
          <div key={g.id} className="evrow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small">{g.name}{g.plusOnes > 0 && <span className="muted"> +{g.plusOnes}</span>}</div>
              <div className="tiny muted">{g.phone ?? 'no phone'} · {1 + g.plusOnes} head{g.plusOnes ? 's' : ''}</div>
            </div>
            <button className={`chip ${g.arrived ? 'on' : ''}`} onClick={() => toggleGlistArrived(g.id)}>
              {g.arrived ? 'Arrived ✓' : 'Mark arrived'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}
              onClick={() => removeGlist(g.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>guest-list names show in the scanner as free entries · they don't consume ticket inventory</div>
    </div>
  );
}
