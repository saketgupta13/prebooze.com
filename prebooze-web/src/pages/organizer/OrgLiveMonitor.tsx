import { useEffect, useState } from 'react';
import { organizer, type OrgLiveMonitor } from '../../api';
import { ApiError } from '../../api/client';
import type { Event } from '../../types';

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
};

const REFRESH_MS = 5000;

/** Real live gate monitor — GET /organizer/events/:id/live (reuses the same
 * AdminLiveMonitorService admin's version already computes for real from
 * Booking/CheckInLog: checked-in count, arrivals histogram, gate feed).
 * Polls every 5s like the mock claimed to, except the numbers are real now.
 * Dropped: the "message staff" composer — no real staff-messaging channel
 * exists (Team & roles has no member directory backing it either yet). */
export default function OrgLiveMonitor() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [data, setData] = useState<OrgLiveMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState<'none' | 'checkin'>('none');
  const [ciName, setCiName] = useState('');
  const [ciCount, setCiCount] = useState(1);
  const [ciBusy, setCiBusy] = useState(false);
  const [ciMsg, setCiMsg] = useState('');
  const [pauseBusy, setPauseBusy] = useState(false);

  useEffect(() => {
    organizer
      .events()
      .then((evs) => {
        const live = evs.filter((e) => e.status === 'approved');
        setEvents(live);
        if (live.length) setEventId(live[0].id);
        else setLoading(false);
      })
      .catch((e) => { setErr(e instanceof ApiError ? e.message : 'Failed to load'); setLoading(false); });
  }, []);

  const loadLive = () => {
    if (!eventId) return;
    organizer
      .live(eventId)
      .then(setData)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load live data'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    loadLive();
    const t = setInterval(loadLive, REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const manualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ciName.trim()) return;
    setCiBusy(true);
    setCiMsg('');
    try {
      await organizer.manualCheckIn(eventId, ciName.trim(), ciCount);
      setCiMsg(`✓ ${ciName.trim()} checked in (${ciCount})`);
      setCiName('');
      setCiCount(1);
      loadLive();
    } catch (e2) {
      setCiMsg(e2 instanceof ApiError ? `✕ ${e2.message}` : '✕ Check-in failed');
    } finally {
      setCiBusy(false);
    }
  };

  const togglePause = async () => {
    if (!data) return;
    setPauseBusy(true);
    try {
      await organizer.setSalesPaused(eventId, !data.salesPaused);
      loadLive();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update sales status');
    } finally {
      setPauseBusy(false);
    }
  };

  if (events.length === 0 && !loading) return <div className="muted small">No live events yet — the monitor works once an event is approved.</div>;
  if (loading && !data) return <div className="muted">Loading…</div>;

  const maxH = data ? Math.max(...data.histogram, 1) : 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24 }}>
          Live monitor <span className="badge badge-ok">● LIVE</span>
        </h1>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ maxWidth: 240 }}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>
      <div className="tiny muted-2" style={{ marginBottom: 16 }}>refreshes every 5s · works on staff phones at the gate</div>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

      {data && (
        <>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi"><div className="l">checked in</div><div className="v">{data.checkedIn}</div><div className="tiny muted">{data.pct}% of {data.total}</div></div>
            <div className="kpi"><div className="l">yet to arrive</div><div className="v">{data.remaining}</div></div>
            <div className="kpi"><div className="l">scan rate</div><div className="v">{data.scanRate}/min</div></div>
          </div>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi" style={{ borderColor: 'rgba(255,92,73,.4)' }}>
              <div className="l danger-text">rejected QRs</div>
              <div className="v danger-text">{data.rejected}</div>
            </div>
            <div className="kpi" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }} className="small">
                <span className="bold">Gate progress</span>
                <span className="muted">{data.checkedIn}/{data.total} in</span>
              </div>
              <div className="bar"><div style={{ width: `${data.pct}%`, transition: 'width .4s' }} /></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="small bold" style={{ marginBottom: 8 }}>Arrivals — by 15 min</div>
            <div className="chart" style={{ height: 70 }}>
              {data.histogram.map((v, i) => (
                <div key={i} className="col" style={{ height: `${(v / maxH) * 100}%` }} />
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="small bold" style={{ marginBottom: 8 }}>Gate feed</div>
            {data.feed.length === 0 && <div className="muted small">No scans yet.</div>}
            {data.feed.map((f, i) => (
              <div
                key={f.at + '-' + i}
                className="small"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  border: `1.5px solid ${f.ok ? 'var(--border-3)' : 'var(--danger)'}`,
                  color: f.ok ? 'var(--text)' : 'var(--danger)',
                  borderRadius: 7,
                  padding: '5px 10px',
                  marginBottom: 5,
                }}
              >
                <span>{f.text}</span>
                <span className="muted-2">{ago(f.at)}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className={data.salesPaused ? 'btn btn-pri' : 'btn btn-danger'} style={{ flex: 1 }} disabled={pauseBusy} onClick={togglePause}>
              {pauseBusy ? 'Updating…' : data.salesPaused ? 'Resume gate sales ✓' : 'Pause gate sales'}
            </button>
            <button className={panel === 'checkin' ? 'btn btn-pri' : 'btn btn-ghost'} style={{ flex: 1 }} onClick={() => setPanel(panel === 'checkin' ? 'none' : 'checkin')}>
              Manual check-in
            </button>
          </div>

          {panel === 'checkin' && (
            <form className="card" style={{ borderColor: 'var(--accent)', marginBottom: 12 }} onSubmit={manualCheckIn}>
              <div className="form-row" style={{ alignItems: 'flex-end' }}>
                <div className="field">
                  <span>Guest name or booking #</span>
                  <input value={ciName} onChange={(e) => setCiName(e.target.value)} placeholder="e.g. Sam Rivera or #TKT-88412" autoFocus />
                </div>
                <div className="field" style={{ flex: '0 0 140px' }}>
                  <span>Guests</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCiCount((c) => Math.max(1, c - 1))}>−</button>
                    <b>{ciCount}</b>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCiCount((c) => Math.min(10, c + 1))}>+</button>
                  </div>
                </div>
                <button className="btn btn-pri" style={{ flex: '0 0 auto' }} disabled={ciBusy}>{ciBusy ? 'Checking…' : 'Check in ✓'}</button>
              </div>
              {ciMsg && <div className={`tiny ${ciMsg.startsWith('✕') ? 'danger-text' : ''}`} style={{ marginTop: 8 }}>{ciMsg}</div>}
            </form>
          )}

          <div className="tiny muted-2">
            matches a real booking by # or exact name when it can; otherwise logs it as a walk-up admission
          </div>
        </>
      )}
    </div>
  );
}
