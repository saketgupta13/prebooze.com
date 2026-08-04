import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { promoter as promoterApi, type PromoterMe, type PromoterTeamMember } from '../../api';
import { ApiError } from '../../api/client';
import Loader from '../../components/Loader';
import type { Event } from '../../types';
import type { PromoterGuest } from '../../store/AppContext';

/** Promoter teams — the lead promoter adds sub-promoters who each get their own
 * tagged affiliate link (?via=handle). Their guests roll up to the team but stay
 * individually attributed. Organizers gate this per event via allowTeams. */
export default function PromoterTeam() {
  const [me, setMe] = useState<PromoterMe | null>(null);
  const [team, setTeam] = useState<PromoterTeamMember[]>([]);
  const [promotions, setPromotions] = useState<Event[]>([]);
  const [guests, setGuests] = useState<PromoterGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([promoterApi.me(), promoterApi.team(), promoterApi.promotions()])
      .then(async ([m, t, promos]) => {
        setMe(m);
        setTeam(t);
        setPromotions(promos);
        // team stats need every guest brought across every event this
        // promoter is allowed on — no single "all my guests" endpoint,
        // so fan out per event and merge (bounded by how many events a
        // promoter is actually promoting, never large).
        const perEvent = await Promise.all(promos.map((e) => promoterApi.guests(e.id).catch(() => [])));
        setGuests(perEvent.flat());
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <Loader />;
  if (!me) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Profile not found'}</div>;

  const mySlug = me.slug;
  const teamEvents = promotions.filter((e) => e.promoterConfig?.allowTeams);

  const stats = (h: string) => {
    const g = guests.filter((x) => x.subPromoter === h);
    return { brought: g.length, arrived: g.filter((x) => x.arrived).length };
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = handle.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!name.trim() || !h) {
      setErr('Name and a handle are required');
      return;
    }
    setErr('');
    try {
      await promoterApi.addTeamMember({ name: name.trim(), handle: h, hue: Math.floor(Math.random() * 360) });
      setName('');
      setHandle('');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to add team member');
    }
  };

  const remove = async (id: string) => {
    try {
      await promoterApi.removeTeamMember(id);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to remove');
    }
  };

  const copyLink = (h: string) => {
    const e = teamEvents[0];
    if (!e) {
      setErr('No team-enabled events yet — links activate when an organizer allows teams');
      return;
    }
    const link = `${window.location.origin}/p/${e.slug}/${mySlug}?via=${h}`;
    navigator.clipboard?.writeText(link).catch(() => {});
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Team</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Add sub-promoters to your crew. Each gets a tagged link so you can see exactly who brought whom — their
        guests count toward your list, but arrivals and earnings stay attributed per person.
      </p>

      {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

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
        <h3 style={{ marginBottom: 8 }}>Your crew ({team.length})</h3>
        {team.length === 0 ? (
          <div className="muted small">No sub-promoters yet — add your first above.</div>
        ) : (
          team.map((m) => {
            const s = stats(m.handle);
            return (
              <div key={m.id} className="evrow">
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
                  onClick={() => remove(m.id)}
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
