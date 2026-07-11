import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { Kpi } from '../components/ui';

/** Free-entry guest list per event — artists, press, promoters and VIPs skip tickets entirely. */
export default function GuestList() {
  const { id } = useParams();
  const { events, guestList, addGuestEntry, removeGuestEntry, toggleGuestArrived, session, toast } = useAdmin();
  const event = events.find((e) => e.id === id);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plusOnes, setPlusOnes] = useState(0);

  if (!event) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Event not found</h1>
        <Link to="/events" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Events</Link>
      </div>
    );
  }

  const list = guestList.filter((g) => g.eventId === event.id);
  const totalHeads = list.reduce((a, g) => a + 1 + g.plusOnes, 0);
  const arrived = list.filter((g) => g.arrived).reduce((a, g) => a + 1 + g.plusOnes, 0);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Guest name is required');
      return;
    }
    addGuestEntry({
      id: 'g' + Date.now(),
      eventId: event.id,
      name: name.trim(),
      phone: phone.trim() || undefined,
      plusOnes,
      addedBy: session?.name ?? 'Admin',
      arrived: false,
    });
    setName('');
    setPhone('');
    setPlusOnes(0);
  };

  return (
    <div className="stack fade" style={{ maxWidth: 760, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/events/${event.id}`} style={{ fontSize: 13 }}>← {event.title}</Link>
        <h1 className="page-title">Guest list</h1>
        <span className="tag tag-green">free entry</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => toast('Guest list exported ✓')}>⬇ Export</button>
      </div>

      <div className="kpi-grid">
        <Kpi label="Names on list" value={list.length} />
        <Kpi label="Total heads (incl. +1s)" value={totalHeads} />
        <Kpi label="Arrived" value={<span className="green">{arrived}</span>} />
      </div>

      <form className="card" style={{ border: '1px solid var(--green)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={add}>
        <div className="field" style={{ flex: 1.4, minWidth: 150 }}>
          <label>Guest name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DJ Nova (artist)" />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 130 }}>
          <label>Phone (optional)</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" />
        </div>
        <div className="field" style={{ width: 130 }}>
          <label>Plus-ones</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlusOnes((p) => Math.max(0, p - 1))}>−</button>
            <b>+{plusOnes}</b>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlusOnes((p) => Math.min(6, p + 1))}>+</button>
          </div>
        </div>
        <button type="submit" className="btn btn-pri" style={{ height: 38 }}>Add to list ✓</button>
      </form>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 1.8 }}>Guest</span>
          <span style={{ flex: 1 }}>Phone</span>
          <span style={{ flex: 0.7 }}>Heads</span>
          <span style={{ flex: 1 }}>Added by</span>
          <span style={{ flex: 1 }}>At the gate</span>
          <span style={{ width: 40 }} />
        </div>
        {list.map((g) => (
          <div key={g.id} className="trow" style={{ minWidth: 560 }}>
            <span style={{ flex: 1.8, fontWeight: 700 }}>{g.name}{g.plusOnes > 0 && <span className="muted"> +{g.plusOnes}</span>}</span>
            <span style={{ flex: 1 }} className="muted">{g.phone ?? '—'}</span>
            <span style={{ flex: 0.7 }}>{1 + g.plusOnes}</span>
            <span style={{ flex: 1 }} className="muted">{g.addedBy}</span>
            <span style={{ flex: 1 }}>
              <button
                className={`chip ${g.arrived ? 'on' : ''}`}
                style={{ fontSize: 10.5, padding: '3px 10px' }}
                onClick={() => toggleGuestArrived(g.id)}
              >
                {g.arrived ? 'Arrived ✓' : 'Mark arrived'}
              </button>
            </span>
            <span style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => removeGuestEntry(g.id)}>✕</button>
            </span>
          </div>
        ))}
        {list.length === 0 && <div className="trow muted">Nobody on the list yet — add artists, press and VIPs above.</div>}
      </div>
      <div className="tiny hint">guest-list names show at the gate scanner as free entries · they don't consume ticket inventory</div>
    </div>
  );
}
