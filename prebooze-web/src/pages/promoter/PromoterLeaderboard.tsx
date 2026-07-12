import { useApp } from '../../store/AppContext';
import { EVENTS, PROMOTERS } from '../../data/mock';
import { liveShowRate } from '../../lib/promoterFraud';

/** Reputation board — promoters ranked by show-up rate (the share of their guests
 * who actually walk in). Live arrivals blend with each promoter's track record. */
export default function PromoterLeaderboard() {
  const { user, myEvents, promoterGuests } = useApp();
  const mySlug = user?.promoterUsername ?? '';
  const allEvents = [...myEvents, ...EVENTS];

  const rows = PROMOTERS.map((p) => {
    const live = liveShowRate(promoterGuests, p.slug, allEvents);
    // blend live signal with track record when we have settled guests, else use record
    const rate = live === null ? p.showRate : Math.round((live + p.showRate) / 2);
    const brought = promoterGuests.filter((g) => g.promoterSlug === p.slug).length;
    return { ...p, rate, live, liveBrought: brought };
  }).sort((a, b) => b.rate - a.rate);

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Leaderboard</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Ranked by show-up rate — the share of listed guests who actually arrive. A high rate gets you invited to more
        events and bigger lists.
      </p>

      <div className="card">
        <div className="evrow" style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>
          <span style={{ width: 40 }}>Rank</span>
          <span style={{ flex: 1.6 }}>Promoter</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Guests</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Show-rate</span>
        </div>
        {rows.map((r, i) => {
          const me = r.slug === mySlug;
          return (
            <div key={r.slug} className="evrow" style={me ? { background: 'rgba(155,225,61,.08)', borderRadius: 8 } : undefined}>
              <span style={{ width: 40, fontWeight: 700 }}>{medal(i)}</span>
              <span style={{ flex: 1.6, minWidth: 0 }}>
                <span className="avatar" style={{ background: `hsl(${r.hue} 60% 45%)`, color: '#fff', width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, marginRight: 8 }}>
                  {r.name[0]}
                </span>
                <b className="small">{r.name}</b> {r.verified && <span className="verified">✓</span>}
                {me && <span className="badge badge-accent" style={{ marginLeft: 6 }}>you</span>}
              </span>
              <span style={{ flex: 1, textAlign: 'right' }} className="small muted">
                {(r.guestsBrought + r.liveBrought).toLocaleString('en-IN')}
              </span>
              <span style={{ flex: 1, textAlign: 'right' }}>
                <b className={r.rate >= 75 ? 'accent' : r.rate >= 65 ? '' : 'danger-text'}>{r.rate}%</b>
                {r.live !== null && <span className="tiny muted-2" style={{ display: 'block' }}>live {r.live}%</span>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 12 }}>
        no-shows drag your rate down — guests who miss too many free lists get blocked automatically, protecting your score
      </div>
    </div>
  );
}
