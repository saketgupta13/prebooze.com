import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDate } from '../../data/mock';
import { promoter as promoterApi, type PromoterTeamMember } from '../../api';
import { ApiError } from '../../api/client';
import { cutoffDate, countdownLabel } from '../../lib/promoterPass';
import Loader from '../../components/Loader';
import type { Event, PromoterGuest } from '../../types';

/** A promoter's real-time monitor for one event — arrivals, no-shows, show-rate,
 * live countdown, and self check-in at their own door table. */
export default function PromoterGuestList() {
  const { eventId } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<PromoterGuest[]>([]);
  const [team, setTeam] = useState<PromoterTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([promoterApi.promotions(), promoterApi.guests(eventId), promoterApi.team()])
      .then(([promotions, g, t]) => {
        setEvent(promotions.find((e) => e.id === eventId) ?? null);
        setGuests(g);
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

  if (!event || !event.promoterConfig?.enabled) {
    return (
      <div>
        <h1 style={{ fontSize: 24 }}>Event not found</h1>
        {err && <div className="tiny danger-text" style={{ marginTop: 8 }}>{err}</div>}
        <Link to="/promoter/promotions" className="btn btn-ghost" style={{ marginTop: 12 }}>← My promotions</Link>
      </div>
    );
  }

  const mine = guests;
  const cap = event.promoterConfig.cap;
  const venue = event.venue;
  const cutoff = cutoffDate(event);
  const closed = cutoff ? Date.now() >= cutoff.getTime() : false;

  const arrived = mine.filter((g) => g.arrived).length;
  const notYet = mine.length - arrived;
  const noShows = closed ? notYet : 0;
  const showRate = mine.length ? Math.round((arrived / mine.length) * 100) : 0;
  const perHead = event.promoterConfig.perHeadPayout ? event.promoterConfig.perHeadAmount : 0;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/promoter/promotions">← My promotions</Link> / {event.title}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>
          Live guest list{' '}
          {closed ? <span className="badge badge-status-cancelled">list closed</span> : <span className="badge badge-ok">● live</span>}
        </h1>
        {cutoff && !closed && (
          <span className="small muted">free entry closes in <b className="accent">{countdownLabel(cutoff)}</b></span>
        )}
      </div>
      <div className="muted small" style={{ marginBottom: 18 }}>
        {event.title} · {fmtDate(event.date)} · {venue?.name}
      </div>

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi"><div className="l">On your list</div><div className="v">{mine.length}<span className="muted small"> / {cap} cap</span></div></div>
        <div className="kpi"><div className="l">Arrived</div><div className="v accent">{arrived}</div></div>
        <div className="kpi"><div className="l">{closed ? 'No-shows' : 'Not yet in'}</div><div className="v" style={closed && noShows ? { color: 'var(--danger)' } : undefined}>{closed ? noShows : notYet}</div></div>
      </div>
      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="l">Show-up rate</div><div className="v">{showRate}%</div></div>
        {perHead > 0 && (
          <div className="kpi"><div className="l">Earned (₹{perHead}/arrival)</div><div className="v accent">₹{(arrived * perHead).toLocaleString('en-IN')}</div></div>
        )}
      </div>

      {event.promoterConfig.allowTeams && (team.length > 0 || mine.some((g) => g.subPromoter)) && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 8 }}>By team member <span className="badge badge-accent">teams on</span></h3>
          {(() => {
            const groups = new Map<string, { name: string; brought: number; arrived: number }>();
            const label = (h?: string) =>
              h ? (team.find((m) => m.handle === h)?.name ?? '@' + h) : 'You (direct)';
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
        <h3 style={{ marginBottom: 8 }}>Your guests</h3>
        {err && <div className="tiny danger-text" style={{ marginBottom: 8 }}>{err}</div>}
        {mine.length === 0 ? (
          <div className="muted small">Nobody yet — share your affiliate link and guests appear here the moment they join.</div>
        ) : (
          <>
            <div className="evrow" style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>
              <span style={{ flex: 1.6 }}>Guest</span>
              <span style={{ flex: 1 }}>Phone</span>
              <span style={{ flex: 0.5 }}>Age</span>
              <span style={{ flex: 1 }}>Gender</span>
              <span style={{ flex: 1 }}>Gate</span>
            </div>
            {mine.map((g) => (
              <div key={g.id} className="evrow">
                <span style={{ flex: 1.6 }} className="bold small">
                  {g.name}
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
    </div>
  );
}
