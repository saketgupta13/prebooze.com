import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { promoter as promoterApi, type PromoterMe, type PromoterTeamMember } from '../../api';
import { ApiError } from '../../api/client';
import Loader from '../../components/Loader';
import type { Event } from '../../types';
import type { PromoterGuest } from '../../store/AppContext';

const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

interface TeamEarningRow {
  teamMemberId: string; memberName: string; eventId: string; eventTitle: string; eventDate: string;
  perHead: number; commission: number; rawTotal: number; splitPct: number; owed: number; status: 'pending' | 'paid';
}

/** Promoter teams — the lead promoter adds sub-promoters who each get their own
 * tagged links (free-entry, and a ticket link when the lead has revenue-share
 * on an event) so guests they bring stay individually attributed. No separate
 * login for a sub-promoter — this is the lead's own crew bookkeeping: what
 * each member is owed (their tagged earnings × their split %), which the
 * lead pays directly and marks settled here. Organizers gate teams per event
 * via allowTeams. */
export default function PromoterTeam() {
  const [me, setMe] = useState<PromoterMe | null>(null);
  const [team, setTeam] = useState<PromoterTeamMember[]>([]);
  const [promotions, setPromotions] = useState<Event[]>([]);
  const [guests, setGuests] = useState<PromoterGuest[]>([]);
  const [earnings, setEarnings] = useState<TeamEarningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [splitPct, setSplitPct] = useState('');
  const [quotaShare, setQuotaShare] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSplit, setEditSplit] = useState('');
  const [editQuota, setEditQuota] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [copied, setCopied] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([promoterApi.me(), promoterApi.team(), promoterApi.promotions(), promoterApi.teamEarnings()])
      .then(async ([m, t, promos, e]) => {
        setMe(m);
        setTeam(t);
        setPromotions(promos);
        setEarnings(e);
        // team stats need every guest brought across every event this
        // promoter is allowed on — no single "all my guests" endpoint,
        // so fan out per event and merge (bounded by how many events a
        // promoter is actually promoting, never large).
        const perEvent = await Promise.all(promos.map((ev) => promoterApi.guests(ev.id).catch(() => [])));
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
  // team-enabled events where the lead ALSO has revenue-share — the only
  // ones where a ticket (?ref=&via=) link means anything for this crew
  const commissionTeamEvents = teamEvents.filter((e) => (e.promoterConfig?.revenueShare?.[mySlug] ?? 0) > 0);

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
      await promoterApi.addTeamMember({
        name: name.trim(), handle: h, hue: Math.floor(Math.random() * 360),
        payoutSplitPct: +splitPct || 0,
        monthlyQuotaShare: +quotaShare > 0 ? +quotaShare : null,
      });
      setName(''); setHandle(''); setSplitPct(''); setQuotaShare('');
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

  const startEdit = (m: PromoterTeamMember) => {
    setEditingId(m.id);
    setEditSplit(String(m.payoutSplitPct ?? 0));
    setEditQuota(m.monthlyQuotaShare ? String(m.monthlyQuotaShare) : '');
  };
  const saveEdit = async (id: string) => {
    try {
      await promoterApi.updateTeamMember(id, { payoutSplitPct: +editSplit || 0, monthlyQuotaShare: +editQuota > 0 ? +editQuota : null });
      setEditingId(null);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    }
  };

  const markPaid = async (teamMemberId: string, eventId: string) => {
    const key = `${teamMemberId}-${eventId}`;
    setActingOn(key);
    try {
      await promoterApi.markTeamMemberPaid(teamMemberId, eventId);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update');
    } finally {
      setActingOn(null);
    }
  };

  const copy = (link: string, key: string) => {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };
  const freeEntryLink = (h: string) => {
    const e = teamEvents[0];
    return e ? `${window.location.origin}/p/${e.slug}/${mySlug}?via=${h}` : null;
  };
  const ticketLink = (h: string) => {
    const e = commissionTeamEvents[0];
    return e ? `${window.location.origin}/events/${e.slug}?ref=${mySlug}&via=${h}` : null;
  };

  const earningsByMember = new Map<string, TeamEarningRow[]>();
  earnings.forEach((r) => earningsByMember.set(r.teamMemberId, [...(earningsByMember.get(r.teamMemberId) ?? []), r]));

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Team</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Add sub-promoters to your crew. Each gets tagged links so you can see exactly who brought whom — their guests
        count toward your list, but arrivals and earnings stay attributed per person. You pay your crew directly
        (Prebooze doesn't move this money); set a split % so this page can show what each person is owed.
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
        <div className="form-row">
          <div className="field">
            <span>Payout split %</span>
            <input value={splitPct} onChange={(e) => setSplitPct(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="e.g. 30" />
          </div>
          <div className="field">
            <span>Monthly guest cap (optional)</span>
            <input value={quotaShare} onChange={(e) => setQuotaShare(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="blank = no separate cap" />
          </div>
        </div>
        <button className="btn btn-pri">Add to team ✓</button>
      </form>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Your crew ({team.length})</h3>
        {team.length === 0 ? (
          <div className="muted small">No sub-promoters yet — add your first above.</div>
        ) : (
          team.map((m) => {
            const s = stats(m.handle);
            const editing = editingId === m.id;
            const fLink = freeEntryLink(m.handle);
            const tLink = ticketLink(m.handle);
            return (
              <div key={m.id} style={{ borderBottom: '1px solid var(--border-dash)', padding: '10px 0' }}>
                <div className="evrow" style={{ padding: 0 }}>
                  <span className="avatar" style={{ background: `hsl(${m.hue} 60% 45%)`, color: '#fff', width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                    {m.name[0]?.toUpperCase()}
                  </span>
                  <div style={{ flex: 1.4, minWidth: 0 }}>
                    <div className="bold small">{m.name}</div>
                    <div className="tiny muted-2">@{m.handle} · {m.payoutSplitPct}% split{m.monthlyQuotaShare ? ` · cap ${m.monthlyQuotaShare}/mo` : ''}</div>
                  </div>
                  <div style={{ flex: 1 }} className="small">
                    <b className="accent">{s.brought}</b> brought · <b className="accent">{s.arrived}</b> in
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => (editing ? setEditingId(null) : startEdit(m))}>
                    {editing ? 'Cancel' : '✎ Edit'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}
                    onClick={() => remove(m.id)}
                  >
                    ✕
                  </button>
                </div>
                {editing && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 10, paddingLeft: 40, flexWrap: 'wrap' }}>
                    <div className="field" style={{ maxWidth: 140, marginBottom: 0 }}>
                      <span className="tiny">Payout split %</span>
                      <input value={editSplit} onChange={(e) => setEditSplit(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" />
                    </div>
                    <div className="field" style={{ maxWidth: 180, marginBottom: 0 }}>
                      <span className="tiny">Monthly guest cap</span>
                      <input value={editQuota} onChange={(e) => setEditQuota(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="blank = none" />
                    </div>
                    <button className="btn btn-pri btn-sm" onClick={() => saveEdit(m.id)}>Save</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 40, flexWrap: 'wrap' }}>
                  {fLink && (
                    <button className="btn btn-ghost btn-sm" onClick={() => copy(fLink, `f-${m.handle}`)}>
                      {copied === `f-${m.handle}` ? 'Copied ✓' : '🎟️ Copy free-entry link'}
                    </button>
                  )}
                  {tLink && (
                    <button className="btn btn-ghost btn-sm" onClick={() => copy(tLink, `t-${m.handle}`)}>
                      {copied === `t-${m.handle}` ? 'Copied ✓' : '💰 Copy ticket link'}
                    </button>
                  )}
                  {!fLink && !tLink && <span className="tiny muted-2">links activate once an organizer enables teams on an event</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {earnings.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>What you owe your crew</h3>
          <p className="tiny muted-2" style={{ marginBottom: 12 }}>
            Each member's split of their own tagged earnings, per event. You pay them directly — mark it once you have.
          </p>
          {[...earningsByMember.entries()].map(([teamMemberId, rows]) => (
            <div key={teamMemberId} style={{ marginBottom: 14 }}>
              <div className="bold small" style={{ marginBottom: 6 }}>{rows[0].memberName}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map((r) => (
                  <div key={r.eventId} className="evrow">
                    <div style={{ flex: 1.4, minWidth: 0 }}>
                      <div className="small">{r.eventTitle}</div>
                      <div className="tiny muted-2">{fmtDate(r.eventDate)} · raw {fmtMoney(r.rawTotal)} × {r.splitPct}%</div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 1 }}>
                      <div className="small bold">{fmtMoney(r.owed)}</div>
                      <div className="tiny" style={{ color: r.status === 'paid' ? 'var(--green, #2a9d5c)' : 'var(--muted-2)' }}>
                        {r.status === 'paid' ? 'Paid ✓' : 'Not paid yet'}
                      </div>
                    </div>
                    {r.status !== 'paid' && (
                      <button
                        className="btn btn-pri btn-sm"
                        disabled={actingOn === `${teamMemberId}-${r.eventId}`}
                        onClick={() => markPaid(teamMemberId, r.eventId)}
                      >
                        I paid them ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="tiny muted-2" style={{ marginTop: 12 }}>
        share a member's link and every guest who joins through it (or ticket sale through their ticket link) is
        tagged to them · see the split live under <Link to="/promoter/promotions" className="link">My promotions</Link>
      </div>
    </div>
  );
}
