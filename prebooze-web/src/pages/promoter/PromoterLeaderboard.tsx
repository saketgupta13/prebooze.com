import { useEffect, useState, type ReactNode } from 'react';
import { promoter as promoterApi, type LeaderboardRow } from '../../api';
import { ApiError } from '../../api/client';
import Loader from '../../components/Loader';
import { Medal, CheckCircle2 } from 'lucide-react';

/** Reputation board — promoters ranked by show-up rate (the share of their guests
 * who actually walk in). GET /promoter/leaderboard computes this live off
 * PromoterGuest, same "decided" definition (arrived, or cutoff passed) the
 * mock used to blend client-side. */
export default function PromoterLeaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [mySlug, setMySlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([promoterApi.leaderboard(), promoterApi.me()])
      .then(([r, m]) => { setRows(r); setMySlug(m.slug); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (err) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err}</div>;

  const medal = (i: number): ReactNode =>
    i === 0 ? <Medal size={18} style={{ color: '#d4af37' }} /> :
    i === 1 ? <Medal size={18} style={{ color: '#a8a8a8' }} /> :
    i === 2 ? <Medal size={18} style={{ color: '#c07a3d' }} /> :
    `#${i + 1}`;

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
                <b className="small">{r.name}</b> {r.verified && <span className="verified" style={{ display: 'inline-flex', verticalAlign: 'middle' }}><CheckCircle2 size={13} /></span>}
                {me && <span className="badge badge-accent" style={{ marginLeft: 6 }}>you</span>}
              </span>
              <span style={{ flex: 1, textAlign: 'right' }} className="small muted">
                {r.brought.toLocaleString('en-IN')}
              </span>
              <span style={{ flex: 1, textAlign: 'right' }}>
                {r.rate === null ? (
                  <span className="tiny muted-2">no data yet</span>
                ) : (
                  <b className={r.rate >= 75 ? 'accent' : r.rate >= 65 ? '' : 'danger-text'}>{r.rate}%</b>
                )}
              </span>
            </div>
          );
        })}
        {rows.length === 0 && <div className="muted small" style={{ padding: 12 }}>No verified promoters yet.</div>}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 12 }}>
        no-shows drag your rate down — guests who miss too many free lists get blocked automatically, protecting your score
      </div>
    </div>
  );
}
