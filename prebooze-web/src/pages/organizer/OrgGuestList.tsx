import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { PROMOTERS } from '../../data/mock';
import { cutoffDate, countdownLabel } from '../../lib/promoterPass';
import { EVENTS } from '../../data/mock';

/** Free-entry guest list — full admin-parity version: KPIs, name + phone for
 * every plus-one, arrived toggles, export. */
export default function OrgGuestList() {
  const { user, myEvents, glist, addGlist, removeGlist, toggleGlistArrived, toast } = useApp();
  const orgEvents = [
    ...myEvents,
    ...EVENTS.filter((e) => e.organizerId === 'livewire' && !myEvents.some((m) => m.id === e.id)),
  ];
  const [eventId, setEventId] = useState(orgEvents[0]?.id ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plusOnes, setPlusOnes] = useState(0);
  const [companions, setCompanions] = useState<{ name: string; phone: string }[]>([]);

  const setCompanion = (i: number, patch: Partial<{ name: string; phone: string }>) =>
    setCompanions((prev) => {
      const next = [...prev];
      while (next.length < i + 1) next.push({ name: '', phone: '' });
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const list = glist.filter((g) => g.eventId === eventId);
  const heads = list.reduce((a, g) => a + 1 + g.plusOnes, 0);
  const arrived = list.filter((g) => g.arrived).reduce((a, g) => a + 1 + g.plusOnes, 0);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Guest name is required');
      return;
    }
    if (!phone.trim()) {
      toast('WhatsApp number is required for the main guest');
      return;
    }
    const comps = companions.slice(0, plusOnes);
    for (let i = 0; i < plusOnes; i++) {
      if (!comps[i]?.name.trim()) {
        toast(`Name is required for plus-one ${i + 1}`);
        return;
      }
      if (!comps[i]?.phone.trim()) {
        toast(`WhatsApp number is required for plus-one ${i + 1}`);
        return;
      }
    }
    const finalComps = comps.map((c) => ({ name: c.name.trim(), phone: c.phone.trim() }));
    addGlist({
      id: 'g' + Date.now(),
      eventId,
      name: name.trim(),
      phone: phone.trim(),
      plusOnes,
      companions: finalComps,
      addedBy: user?.orgBrand ?? user?.name ?? 'Organizer',
      arrived: false,
    });
    toast(`${name.trim()} added to guest list ✓`);
    setName('');
    setPhone('');
    setPlusOnes(0);
    setCompanions([]);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>
          Guest list <span className="badge badge-ok">free entry</span>
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ maxWidth: 240 }}>
            {orgEvents.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => toast('Guest list exported ✓')}>⬇ Export</button>
        </div>
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
            <span>WhatsApp number *</span>
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
        {plusOnes > 0 && (
          <div style={{ borderTop: '1px dashed var(--border-dash)', paddingTop: 10, marginBottom: 12 }}>
            <div className="tiny muted-2" style={{ marginBottom: 8 }}>name &amp; WhatsApp number required for each plus-one (checked at the gate):</div>
            {Array.from({ length: plusOnes }, (_, i) => (
              <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                <input
                  value={companions[i]?.name ?? ''}
                  onChange={(e) => setCompanion(i, { name: e.target.value })}
                  placeholder={`Plus-one ${i + 1} name *`}
                />
                <input
                  value={companions[i]?.phone ?? ''}
                  onChange={(e) => setCompanion(i, { phone: e.target.value })}
                  placeholder="WhatsApp number *"
                />
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-pri">Add to list ✓</button>
      </form>

      <div className="card">
        {list.length === 0 && <div className="muted small">Nobody on the list yet — add artists, press and VIPs above.</div>}
        {list.map((g) => (
          <div key={g.id} className="evrow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small">
                {g.name}
                {g.plusOnes > 0 && <span className="muted"> +{g.plusOnes}</span>}
              </div>
              {(g.companions ?? []).length > 0 && (
                <div className="tiny muted">
                  with {(g.companions ?? []).map((c) => c.name + (c.phone ? ` (${c.phone})` : '')).join(', ')}
                </div>
              )}
              <div className="tiny muted-2">
                {g.phone ?? 'no phone'} · {1 + g.plusOnes} head{g.plusOnes ? 's' : ''} · added by {g.addedBy ?? 'you'}
              </div>
            </div>
            <button className={`chip ${g.arrived ? 'on' : ''}`} onClick={() => toggleGlistArrived(g.id)}>
              {g.arrived ? 'Arrived ✓' : 'Mark arrived'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}
              onClick={() => {
                removeGlist(g.id);
                toast('Removed from guest list');
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>
        guest-list names show in the scanner as free entries · they don't consume ticket inventory
      </div>

      <PromoterGuestsSection eventId={eventId} />
    </div>
  );
}


/** Unified door view — promoter-brought guests for this event, grouped by promoter,
 * tagged with attribution, with cutoff validity and check-in. */
function PromoterGuestsSection({ eventId }: { eventId: string }) {
  const { myEvents, promoterGuests, checkInPromoterGuest } = useApp();
  const event = [...myEvents, ...EVENTS].find((e) => e.id === eventId);
  if (!event?.promoterConfig?.enabled) return null;

  const guests = promoterGuests.filter((g) => g.eventId === eventId);
  const cutoff = cutoffDate(event);
  const closed = cutoff ? Date.now() >= cutoff.getTime() : false;
  const byPromoter = new Map<string, typeof guests>();
  guests.forEach((g) => {
    const arr = byPromoter.get(g.promoterSlug) ?? [];
    arr.push(g);
    byPromoter.set(g.promoterSlug, arr);
  });
  const promoterName = (slug: string) => PROMOTERS.find((p) => p.slug === slug)?.name ?? slug;
  const arrived = guests.filter((g) => g.arrived).length;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
        <h3>Promoter guests <span className="badge badge-accent">free entry</span></h3>
        <span className="small muted">
          {arrived}/{guests.length} arrived · cap {event.promoterConfig.cap} ·{' '}
          {closed ? <span className="danger-text">list closed</span> : cutoff ? <>closes in <b className="accent">{countdownLabel(cutoff)}</b></> : ''}
        </span>
      </div>
      {guests.length === 0 ? (
        <div className="muted small" style={{ marginTop: 8 }}>No promoter guests yet for this event.</div>
      ) : (
        [...byPromoter.entries()].map(([slug, list]) => (
          <div key={slug} style={{ marginTop: 12 }}>
            <div className="small bold" style={{ marginBottom: 4 }}>
              📣 {promoterName(slug)} <span className="muted" style={{ fontWeight: 400 }}>· {list.filter((g) => g.arrived).length}/{list.length} in</span>
            </div>
            {list.map((g) => (
              <div key={g.id} className="evrow">
                <span style={{ flex: 1.6 }} className="bold small">{g.name}</span>
                <span style={{ flex: 1 }} className="muted small">{g.phone}</span>
                <span style={{ flex: 0.7 }} className="small">{g.age} · {g.gender[0]}</span>
                <span style={{ flex: 1 }}>
                  <button
                    className={`chip ${g.arrived ? 'on' : ''}`}
                    style={{ fontSize: 10.5, padding: '3px 10px' }}
                    disabled={closed && !g.arrived}
                    title={closed && !g.arrived ? 'Free window closed' : ''}
                    onClick={() => checkInPromoterGuest(g.id)}
                  >
                    {g.arrived ? 'Arrived ✓' : closed ? 'No-show' : 'Check in'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        ))
      )}
      <div className="tiny muted-2" style={{ marginTop: 10 }}>
        each guest is tagged with the promoter who brought them · after the cutoff, un-arrived guests count as no-shows
      </div>
    </div>
  );
}
