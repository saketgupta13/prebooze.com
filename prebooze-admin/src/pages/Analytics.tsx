import { useEffect, useState } from 'react';
import { liveFunnel, FUNNEL_STAGES, LiveApiError, type FunnelStageCount } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Funnel';

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Real booking-funnel visibility (GET /admin/funnel) — before this, the
 * only way to see where real guests were dropping off was to hand-query
 * Cart/Booking rows over SSH. Counts are distinct sessions that reached
 * each stage, not raw event fires, so a reload doesn't inflate the numbers. */
export default function Funnel() {
  const session = useLiveSession();
  const { token } = session;

  // Computed at mount, not module load — an admin tab left open across
  // midnight shouldn't default to a silently stale "today".
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [stages, setStages] = useState<FunnelStageCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveFunnel
      // Explicit Z — a bare "T23:59:59" has no timezone, so JS parses it as
      // the *server's* local time (this bit in local dev, where the server
      // is IST); an unambiguous UTC boundary is required either way.
      .get({ from, to: to ? `${to}T23:59:59Z` : undefined })
      .then((r) => setStages(r.stages))
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const countFor = (type: string) => stages.find((s) => s.type === type)?.sessions ?? 0;
  const first = countFor(FUNNEL_STAGES[0].type);
  let prevCount = 0;

  return (
    <div className="stack fade" style={{ maxWidth: 760 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="page-hd">
        <h1 className="page-title">Funnel</h1>
      </div>
      <p className="tiny hint" style={{ marginTop: -6 }}>
        Distinct browser sessions that reached each step — a guest reloading a page doesn't inflate these numbers.
      </p>

      <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 160 }}>
          <label>From</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ maxWidth: 160 }}>
          <label>To</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn btn-pri btn-sm" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      <div className="card">
        {FUNNEL_STAGES.map((stage, i) => {
          const count = countFor(stage.type);
          const ofFirst = first ? Math.round((count / first) * 100) : 0;
          const ofPrev = i === 0 ? null : prevCount ? Math.round((count / prevCount) * 100) : 0;
          const barPct = first ? Math.max(2, Math.round((count / first) * 100)) : 0;
          prevCount = count;
          return (
            <div key={stage.type} style={{ padding: '10px 0', borderBottom: i < FUNNEL_STAGES.length - 1 ? '1px solid var(--border-soft)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span className="small bold">{stage.label}</span>
                <span className="small">
                  <b>{count.toLocaleString('en-IN')}</b>
                  <span className="tiny muted" style={{ marginLeft: 8 }}>
                    {ofFirst}% of viewed{ofPrev !== null && ` · ${ofPrev}% of previous step`}
                  </span>
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--border-soft)', overflow: 'hidden' }}>
                <div style={{ width: `${barPct}%`, height: '100%', background: 'var(--green)' }} />
              </div>
            </div>
          );
        })}
        {!loading && first === 0 && (
          <div className="tiny muted" style={{ padding: '10px 0' }}>No activity in this range yet.</div>
        )}
      </div>
    </div>
  );
}
