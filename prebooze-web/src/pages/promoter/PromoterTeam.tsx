import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS } from '../../data/mock';

/** Promoter teams — the lead promoter adds sub-promoters who each get their own
 * tagged affiliate link (?via=handle). Their guests roll up to the team but stay
 * individually attributed. Organizers gate this per event via allowTeams. */
export default function PromoterTeam() {
  const { user, myEvents, promoterGuests, promoterTeam, addSubPromoter, removeSubPromoter, toast } = useApp();
  const mySlug = user?.promoterUsername ?? '';
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');

  const allEvents = [...myEvents, ...EVENTS.filter((e) => !myEvents.some((m) => m.id === e.id))];
  const teamEvents = allEvents.filter(
    (e) => e.status === 'approved' && e.promoterConfig?.enabled && e.promoterConfig.allowTeams && e.promoterConfig.allowedPromoters.includes(mySlug)
  );

  const stats = (h: string) => {
    const g = promoterGuests.filter((x) => x.promoterSlug === mySlug && x.subPromoter === h);
    return { brought: g.length, arrived: g.filter((x) => x.arrived).length };
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const h = handle.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!name.trim() || !h) {
      toast('Name and a handle are required');
      return;
    }
    if (promoterTeam.some((m) => m.handle === h)) {
      toast('That handle is already on your team');
      return;
    }
    addSubPromoter({ name: name.trim(), handle: h, hue: Math.floor(Math.random() * 360) });
    toast(`${name.trim()} added to your team ✓`);
    setName('');
    setHandle('');
  };

  const copyLink = (h: string) => {
    const e = teamEvents[0];
    if (!e) {
      toast('No team-enabled events yet — links activate when an organizer allows teams');
      return;
    }
    const link = `${window.location.origin}/p/${e.slug}/${mySlug}?via=${h}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    toast('Sub-promoter link copied ✓');
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Team</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Add sub-promoters to your crew. Each gets a tagged link so you can see exactly who brought whom — their
        guests count toward your list, but arrivals and earnings stay attributed per person.
      </p>

      <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>
        {teamEvents.length > 0 ? (
          <>Teams are enabled on <b>{teamEvents.length}</b> of your event{teamEvents.length === 1 ? '' : 's'} — sub-links are live for those.</>
        ) : (
          <>No team-enabled events yet. Organizers turn on <b>promoter teams</b> per event; once they do, your crew's links go live here.</>
        )}
      </div>

      <form className="card" style={{ marginBottom: 16 }} onSubmit={add}>
        <div className="form-row">
          <div className="field">
            <span>Sub-promoter name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aisha K." />
          </div>
          <div className="field">
            <span>Handle</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="aisha" />
          </div>
        </div>
        <button className="btn btn-pri">Add to team ✓</button>
      </form>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Your crew ({promoterTeam.length})</h3>
        {promoterTeam.length === 0 ? (
          <div className="muted small">No sub-promoters yet — add your first above.</div>
        ) : (
          promoterTeam.map((m) => {
            const s = stats(m.handle);
            return (
              <div key={m.handle} className="evrow">
                <span className="avatar" style={{ background: `hsl(${m.hue} 60% 45%)`, color: '#fff', width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                  {m.name[0]?.toUpperCase()}
                </span>
                <div style={{ flex: 1.4, minWidth: 0 }}>
                  <div className="bold small">{m.name}</div>
                  <div className="tiny muted-2">@{m.handle}</div>
                </div>
                <div style={{ flex: 1 }} className="small">
                  <b className="accent">{s.brought}</b> brought · <b className="accent">{s.arrived}</b> in
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => copyLink(m.handle)}>🔗 Link</button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}
                  onClick={() => { removeSubPromoter(m.handle); toast(`${m.name} removed from team`); }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="tiny muted-2" style={{ marginTop: 12 }}>
        share a member's link and every guest who joins through it is tagged to them · see the split live under{' '}
        <Link to="/promoter/promotions" className="link">My promotions</Link>
      </div>
    </div>
  );
}
