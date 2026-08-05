import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDate } from '../../data/mock';
import { promoter as promoterApi, type PromoterMe, type PromoterTeamMember } from '../../api';
import { ApiError } from '../../api/client';
import { cutoffDate, countdownLabel } from '../../lib/promoterPass';
import Loader from '../../components/Loader';
import type { Event } from '../../types';
import type { PromoterGuest } from '../../store/AppContext';

type Mode = 'guestlist' | 'commission';
interface PaidGuest {
  id: string;
  mainGuest: string;
  qty: number;
  subtotal: number;
  promoterCommission: number;
  createdAt: string;
}

const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function downloadCsv(filename: string, header: string, rows: string[]) {
  const csv = [header, ...rows].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

/** A promoter's real-time monitor for one event — arrivals, no-shows, show-rate,
 * live countdown, self check-in at their own door table, and (separately) who
 * actually bought a ticket through their paid-commission link. Shown as two
 * tabs when both modes are active for this promoter on this event, or just
 * the one that applies — matching PromoterPromotions.tsx's same pattern. */
export default function PromoterGuestList() {
  const { eventId } = useParams();
  const [me, setMe] = useState<PromoterMe | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<PromoterGuest[]>([]);
  const [paidGuests, setPaidGuests] = useState<PaidGuest[]>([]);
  const [team, setTeam] = useState<PromoterTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Mode | null>(null);
  const [subFilter, setSubFilter] = useState('all'); // 'all' | 'direct' | a team member's handle

  const load = () => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([
      promoterApi.me(),
      promoterApi.promotions(),
      promoterApi.guests(eventId),
      promoterApi.paidGuests(eventId).catch(() => []),
      promoterApi.team(),
    ])
      .then(([m, promotions, g, pg, t]) => {
        setMe(m);
        setEvent(promotions.find((e) => e.id === eventId) ?? null);
        setGuests(g);
        setPaidGuests(pg);
        setTeam(t);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [eventId]);

  // tick so the countdown + no-show status stay current
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const checkIn = async (id: string) => {
    try {
      await promoterApi.checkInGuest(id);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to check in');
    }
  };

  if (loading) return <Loader />;

  if (!event || !event.promoterConfig?.enabled || !me) {
    return (
      <div>
        <h1 style={{ fontSize: 24 }}>Event not found</h1>
        {err && <div className="tiny danger-text" style={{ marginTop: 8 }}>{err}</div>}
        <Link to="/promoter/promotions" className="btn btn-ghost" style={{ marginTop: 12 }}>← My promotions</Link>
      </div>
    );
  }

  const cfg = event.promoterConfig;
  const guestListOn = (cfg.guestListPromoters ?? cfg.allowedPromoters ?? []).includes(me.slug);
  const revSharePct = cfg.revenueShare?.[me.slug] ?? 0;
  const commissionOn = revSharePct > 0;
  const modes: Mode[] = [...(guestListOn ? (['guestlist'] as const) : []), ...(commissionOn ? (['commission'] as const) : [])];
  const activeTab: Mode | undefined = modes.length > 1 ? (tab ?? modes[0]) : modes[0];

  const mine = guests;
  const withTag = mine.filter((g) => g.subPromoter).length;
  const filteredGuests =
    subFilter === 'all' ? mine : subFilter === 'direct' ? mine.filter((g) => !g.subPromoter) : mine.filter((g) => g.subPromoter === subFilter);
  const cap = cfg.cap;
  const venue = event.venue;
  const cutoff = cutoffDate(event);
  const closed = cutoff ? Date.now() >= cutoff.getTime() : false;

  const arrived = mine.filter((g) => g.arrived).length;
  const notYet = mine.length - arrived;
  const noShows = closed ? notYet : 0;
  const showRate = mine.length ? Math.round((arrived / mine.length) * 100) : 0;
  const perHead = cfg.perHeadPayout ? cfg.perHeadAmount : 0;

  const paidCommissionTotal = paidGuests.reduce((sum, b) => sum + b.promoterCommission, 0);
  const paidTicketCount = paidGuests.reduce((sum, b) => sum + b.qty, 0);

  const exportFreeEntry = () =>
    downloadCsv(
      `${event.title} - free entry list.csv`,
      'Name,Phone,Age,Gender,Companions,Party size,Arrived,Brought by',
      filteredGuests.map(
        (g) =>
          `"${g.name}","${g.phone}","${g.age}","${g.gender}","${(g.companions ?? []).map((c) => c.name).join('; ')}",${1 + (g.companions?.length ?? 0)},${g.arrived ? 'yes' : 'no'},"${g.subPromoter ? team.find((m) => m.handle === g.subPromoter)?.name ?? g.subPromoter : 'Direct'}"`,
      ),
    );
  const exportPaid = () =>
    downloadCsv(
      `${event.title} - paid commission list.csv`,
      'Guest,Tickets,Ticket subtotal,Your commission,Date',
      paidGuests.map((b) => `"${b.mainGuest}",${b.qty},${b.subtotal},${b.promoterCommission},"${new Date(b.createdAt).toLocaleDateString('en-IN')}"`),
    );

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/promoter/promotions">← My promotions</Link> / {event.title}
      </div>
      <h1 style={{ fontSize: 24 }}>Live guest list</h1>
      <div className="muted small" style={{ marginBottom: 18 }}>
        {event.title} · {fmtDate(event.date)} · {venue?.name}
      </div>

      {modes.length === 0 && (
        <div className="tiny muted-2">Neither Guest list nor Paid commission is active for you on this event.</div>
      )}

      {modes.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" className={`btn btn-sm ${activeTab === 'guestlist' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => setTab('guestlist')}>
            🎟️ Guest list
          </button>
          <button type="button" className={`btn btn-sm ${activeTab === 'commission' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => setTab('commission')}>
            💰 Paid commission
          </button>
        </div>
      )}

      {activeTab === 'guestlist' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <span>{closed ? <span className="badge badge-status-cancelled">list closed</span> : <span className="badge badge-ok">● live</span>}</span>
            {cutoff && !closed && (
              <span className="small muted">free entry closes in <b className="accent">{countdownLabel(cutoff)}</b></span>
            )}
          </div>

          <div className="kpis" style={{ marginTop: 12, marginBottom: 12 }}>
            <div className="kpi"><div className="l">On your list</div><div className="v">{mine.length}<span className="muted small"> / {cap} cap</span></div></div>
            <div className="kpi"><div className="l">Arrived</div><div className="v accent">{arrived}</div></div>
            <div className="kpi"><div className="l">{closed ? 'No-shows' : 'Not yet in'}</div><div className="v" style={closed && noShows ? { color: 'var(--danger)' } : undefined}>{closed ? noShows : notYet}</div></div>
          </div>
          <div className="kpis" style={{ marginBottom: 18 }}>
            <div className="kpi"><div className="l">Show-up rate</div><div className="v">{showRate}%</div></div>
            {perHead > 0 && (
              <div className="kpi"><div className="l">Earned (₹{perHead}/arrival)</div><div className="v accent">{fmtMoney(arrived * perHead)}</div></div>
            )}
          </div>

          {cfg.allowTeams && (team.length > 0 || mine.some((g) => g.subPromoter)) && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ marginBottom: 8 }}>By team member <span className="badge badge-accent">teams on</span></h3>
              {(() => {
                const groups = new Map<string, { name: string; brought: number; arrived: number }>();
                const label = (h?: string) => (h ? (team.find((m) => m.handle === h)?.name ?? '@' + h) : 'You (direct)');
                mine.forEach((g) => {
                  const key = g.subPromoter ?? '';
                  const cur = groups.get(key) ?? { name: label(g.subPromoter), brought: 0, arrived: 0 };
                  cur.brought += 1;
                  if (g.arrived) cur.arrived += 1;
                  groups.set(key, cur);
                });
                const list = [...groups.values()].sort((a, b) => b.arrived - a.arrived);
                return list.length === 0 ? (
                  <div className="muted small">No guests attributed yet.</div>
                ) : (
                  list.map((m) => (
                    <div key={m.name} className="evrow">
                      <span style={{ flex: 1.6 }} className="bold small">{m.name}</span>
                      <span style={{ flex: 1 }} className="small">{m.brought} brought</span>
                      <span style={{ flex: 1 }} className="small accent">{m.arrived} arrived</span>
                      <span style={{ flex: 0.8 }} className="small muted">{m.brought ? Math.round((m.arrived / m.brought) * 100) : 0}%</span>
                    </div>
                  ))
                );
              })()}
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <h3>Your guests</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {(team.length > 0 || withTag > 0) && (
                  <select className="chip" value={subFilter} onChange={(e) => setSubFilter(e.target.value)}>
                    <option value="all">All guests</option>
                    <option value="direct">Brought directly (you)</option>
                    {team.map((m) => (
                      <option key={m.handle} value={m.handle}>{m.name}</option>
                    ))}
                  </select>
                )}
                <button className="btn btn-ghost btn-sm" onClick={exportFreeEntry} disabled={!filteredGuests.length}>⬇ Export CSV</button>
              </div>
            </div>
            {err && <div className="tiny danger-text" style={{ marginBottom: 8 }}>{err}</div>}
            {mine.length === 0 ? (
              <div className="muted small">Nobody yet — share your affiliate link and guests appear here the moment they join.</div>
            ) : filteredGuests.length === 0 ? (
              <div className="muted small">No guests match this filter.</div>
            ) : (
              <>
                <div className="evrow" style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>
                  <span style={{ flex: 1.6 }}>Guest</span>
                  <span style={{ flex: 1 }}>Phone</span>
                  <span style={{ flex: 0.5 }}>Age</span>
                  <span style={{ flex: 1 }}>Gender</span>
                  <span style={{ flex: 1 }}>Gate</span>
                </div>
                {filteredGuests.map((g) => (
                  <div key={g.id} className="evrow">
                    <span style={{ flex: 1.6 }} className="bold small">
                      {g.name}
                      {(g.companions?.length ?? 0) > 0 && (
                        <span className="tiny muted-2" style={{ fontWeight: 400 }}> +{g.companions!.length} ({g.companions!.map((c) => c.name).join(', ')})</span>
                      )}
                      {g.subPromoter && <span className="tiny muted-2" style={{ fontWeight: 400 }}> · via {team.find((m) => m.handle === g.subPromoter)?.name ?? g.subPromoter}</span>}
                    </span>
                    <span style={{ flex: 1 }} className="muted small">{g.phone}</span>
                    <span style={{ flex: 0.5 }} className="small">{g.age}</span>
                    <span style={{ flex: 1 }} className="muted small">{g.gender}</span>
                    <span style={{ flex: 1 }}>
                      <button
                        className={`chip ${g.arrived ? 'on' : ''}`}
                        style={{ fontSize: 10.5, padding: '3px 10px' }}
                        disabled={g.arrived}
                        onClick={() => checkIn(g.id)}
                      >
                        {g.arrived ? 'Arrived ✓' : closed ? 'No-show' : 'Check in'}
                      </button>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="tiny muted-2" style={{ marginTop: 10 }}>
            arrivals update live as the gate scans your guests · check-ins at the main gate roll up here too
          </div>
        </>
      )}

      {activeTab === 'commission' && (
        <>
          <div className="kpis" style={{ marginBottom: 18 }}>
            <div className="kpi"><div className="l">Paid bookings</div><div className="v">{paidGuests.length}</div></div>
            <div className="kpi"><div className="l">Tickets sold</div><div className="v">{paidTicketCount}</div></div>
            <div className="kpi"><div className="l">Your commission ({revSharePct}%)</div><div className="v accent">{fmtMoney(paidCommissionTotal)}</div></div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <h3>Guests who bought via your link</h3>
              <button className="btn btn-ghost btn-sm" onClick={exportPaid} disabled={!paidGuests.length}>⬇ Export CSV</button>
            </div>
            {err && <div className="tiny danger-text" style={{ marginBottom: 8 }}>{err}</div>}
            {paidGuests.length === 0 ? (
              <div className="muted small">No paid bookings through your ticket link yet.</div>
            ) : (
              <>
                <div className="evrow" style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>
                  <span style={{ flex: 1.6 }}>Guest</span>
                  <span style={{ flex: 0.7 }}>Tickets</span>
                  <span style={{ flex: 1 }}>Subtotal</span>
                  <span style={{ flex: 1 }}>Your cut</span>
                  <span style={{ flex: 1 }}>Date</span>
                </div>
                {paidGuests.map((b) => (
                  <div key={b.id} className="evrow">
                    <span style={{ flex: 1.6 }} className="bold small">{b.mainGuest}</span>
                    <span style={{ flex: 0.7 }} className="small">{b.qty}</span>
                    <span style={{ flex: 1 }} className="muted small">{fmtMoney(b.subtotal)}</span>
                    <span style={{ flex: 1 }} className="small accent">{fmtMoney(b.promoterCommission)}</span>
                    <span style={{ flex: 1 }} className="muted small">{fmtDate(b.createdAt)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="tiny muted-2" style={{ marginTop: 10 }}>
            no phone numbers here — paid bookings go through Prebooze checkout, not to you directly, same as any
            other ticket sale
          </div>
        </>
      )}
    </div>
  );
}
