import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { liveLiveMonitor, LiveApiError, type LiveMonitorOverviewRow } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { fmt } from '../store/data';
import { PauseCircle, AlertTriangle } from 'lucide-react';

const TITLE = 'Live monitor';

/** "Check all events" overview (2026-09-02) — the per-event live monitor
 * (LiveMonitor.tsx) only ever showed ONE event, auto-picked with no way to
 * switch, and nothing in admin ever linked to it at all — the route sat
 * completely orphaned. This lists every currently-relevant event (running
 * now, or not yet started but not yet over — same window definition
 * LiveMonitor.tsx's own default-picker already used) with real checked-in
 * stats side by side, click through to any one for the full gate screen. */
export default function LiveMonitorOverview() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [rows, setRows] = useState<LiveMonitorOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    liveLiveMonitor
      .overview()
      .then(setRows)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    if (!token) return;
    load();
    // Lighter poll than the single-event gate screen's 5s — this is a
    // scan-the-room overview, not something staff stares at during a scan.
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const running = rows.filter((r) => r.isRunning);
  const upcoming = rows.filter((r) => !r.isRunning);

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 className="page-title">Live monitor</h1>
        <div style={{ flex: 1 }} />
        <span className="tiny muted">refreshes every 15s · every approved event that's running or hasn't started yet</span>
      </div>

      {loading && <div className="tiny muted">Loading…</div>}
      {!loading && rows.length === 0 && (
        <div className="card"><div className="tiny muted">No live or upcoming events right now.</div></div>
      )}

      {running.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="tiny muted-2" style={{ fontWeight: 700, letterSpacing: 0.5 }}>RUNNING NOW ({running.length})</div>
          {running.map((r) => <EventRow key={r.id} row={r} onClick={() => navigate(`/events/${r.id}/live`)} />)}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="tiny muted-2" style={{ fontWeight: 700, letterSpacing: 0.5 }}>NOT STARTED YET ({upcoming.length})</div>
          {upcoming.map((r) => <EventRow key={r.id} row={r} onClick={() => navigate(`/events/${r.id}/live`)} />)}
        </div>
      )}
    </div>
  );
}

function EventRow({ row, onClick }: { row: LiveMonitorOverviewRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'left', cursor: 'pointer', border: row.isRunning ? '1px solid var(--green)' : undefined }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{row.title}</div>
          <div className="tiny muted">
            {row.venueName ?? 'Private address'}{row.city ? `, ${row.city}` : ''} ·{' '}
            {new Date(row.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {row.salesPaused && <span className="tag tag-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><PauseCircle size={11} /> Sales paused</span>}
          {row.rejected > 0 && <span className="tag tag-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={11} /> {row.rejected} rejected</span>}
          <span className={row.isRunning ? 'tag tag-green' : 'tag'}>{row.isRunning ? '● Live' : 'Upcoming'}</span>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
          <span className="muted">{fmt(row.checkedIn)}/{fmt(row.total)} checked in</span>
          <span className="bold">{row.pct}%</span>
        </div>
        <div style={{ height: 6, background: 'rgba(139,195,74,.12)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${row.pct}%`, height: '100%', background: 'var(--green)', transition: 'width .4s' }} />
        </div>
      </div>
    </button>
  );
}
