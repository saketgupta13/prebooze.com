import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Kpi } from '../components/ui';
import { fmt } from '../store/data';
import { liveEvents, liveLiveMonitor, LiveApiError, type LiveEvent, type LiveMonitor as LiveMonitorData } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Live monitor';

function ago(at: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

/** Real-time event-night ops screen — checked-in count, arrivals histogram
 * and gate feed all come from Booking/CheckInLog (LiveMonitorService.live),
 * replacing the mock's simulated setInterval ticker. Polls every 5s while
 * the page is open, same cadence the mock claimed. */
export default function LiveMonitor() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [live, setLive] = useState<LiveMonitorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState<'none' | 'checkin'>('none');
  const [ciName, setCiName] = useState('');
  const [ciCount, setCiCount] = useState(1);
  const [msg, setMsg] = useState<ReactNode>('');

  const eventId = id;

  const loadEvents = () => {
    liveEvents.list().then(setEvents).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load events'));
  };

  const loadLive = (silent = false) => {
    if (!eventId) return;
    if (!silent) setLoading(true);
    liveLiveMonitor
      .get(eventId)
      .then(setLive)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    if (token) { loadEvents(); loadLive(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventId]);

  useEffect(() => {
    if (!token || !eventId) return;
    const t = setInterval(() => loadLive(true), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventId]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const event = events.find((e) => e.id === eventId) ?? events.find((e) => e.status === 'approved');

  if (!loading && !event) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">No live event right now</h1>
        <Link to="/events" className="btn btn-ghost" style={{ width: 'fit-content' }}><ArrowLeft size={14} /> Events</Link>
      </div>
    );
  }
  if (!event || !live) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const togglePause = async () => {
    try {
      await liveEvents.setSalesPaused(event.id, !live.salesPaused);
      setMsg(live.salesPaused ? <>Gate sales resumed <CheckCircle2 size={13} /></> : 'Gate sales paused');
      loadLive(true);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const checkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ciName.trim()) { setErr('Enter the guest name or booking #'); return; }
    try {
      await liveLiveMonitor.checkIn(event.id, ciName.trim(), ciCount);
      setMsg(<>{ciName.trim()} checked in manually ({ciCount}) <CheckCircle2 size={13} /></>);
      setCiName(''); setCiCount(1); setPanel('none');
      loadLive(true);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to check in');
    }
  };

  const maxBar = Math.max(...live.histogram, 1);

  return (
    <div className="stack fade" style={{ maxWidth: 760, gap: 14 }}>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/events/${event.id}`} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Event</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{event.title}</h1>
        <span className="tag tag-green">● LIVE</span>
        <div style={{ flex: 1 }} />
        <span className="tiny muted">refreshes every 5s · works on staff phones at the gate</span>
      </div>

      <div className="kpi-grid">
        <Kpi label="checked in" value={fmt(live.checkedIn)} delta={`${live.pct}% of ${fmt(live.total)}`} deltaColor="var(--muted)" />
        <Kpi label="yet to arrive" value={fmt(live.remaining)} />
        <Kpi label="scan rate" value={`${live.scanRate}/min`} />
        <Kpi label="rejected QRs" value={<span className="red">{live.rejected}</span>} alert />
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="small" style={{ fontWeight: 700 }}>Gate progress</span>
          <span className="tiny muted">{fmt(live.checkedIn)}/{fmt(live.total)} in</span>
        </div>
        <div style={{ height: 8, background: 'rgba(139,195,74,.15)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${live.pct}%`, height: '100%', background: 'var(--green)', transition: 'width .4s' }} />
        </div>
      </div>

      <div className="card">
        <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Arrivals — by 15 min</div>
        <div className="bars" style={{ height: 70 }}>
          {live.histogram.map((v, i) => (
            <div key={i} className="bar">
              <div style={{ height: `${(v / maxBar) * 100}%`, opacity: 0.4 + (v / maxBar) * 0.6 }} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Gate feed</div>
        <div className="stack" style={{ gap: 4 }}>
          {live.feed.map((f, i) => (
            <div
              key={f.at + '-' + i}
              className="fade"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                border: `1px solid ${f.ok ? 'rgba(139,195,74,.2)' : 'var(--red)'}`,
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 11.5,
                color: f.ok ? 'var(--text)' : 'var(--red)',
              }}
            >
              <span>{f.text}</span>
              <span className="muted">{ago(f.at)}</span>
            </div>
          ))}
          {live.feed.length === 0 && <div className="tiny muted">No scans yet.</div>}
        </div>
      </div>

      {msg && <div className="tiny" style={{ color: 'var(--green)' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className={live.salesPaused ? 'btn btn-pri' : 'btn btn-danger'} style={{ flex: 1 }} onClick={togglePause}>
          {live.salesPaused ? <>Resume gate sales <CheckCircle2 size={14} /></> : 'Pause gate sales'}
        </button>
        <button
          className={panel === 'checkin' ? 'btn btn-pri' : 'btn btn-ghost'}
          style={{ flex: 1 }}
          onClick={() => setPanel(panel === 'checkin' ? 'none' : 'checkin')}
        >
          Manual check-in
        </button>
      </div>

      {panel === 'checkin' && (
        <form className="card fade" style={{ border: '1px solid var(--green)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={checkIn}>
          <div className="field" style={{ flex: 1.6, minWidth: 160 }}>
            <label>Guest name or booking #</label>
            <input className="input" value={ciName} onChange={(e) => setCiName(e.target.value)} placeholder="e.g. Sam Rivera or #9001" autoFocus />
          </div>
          <div className="field" style={{ width: 130 }}>
            <label>Guests</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCiCount((c) => Math.max(1, c - 1))}>−</button>
              <b>{ciCount}</b>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCiCount((c) => Math.min(10, c + 1))}>+</button>
            </div>
          </div>
          <button type="submit" className="btn btn-pri" style={{ height: 38 }}>Check in <CheckCircle2 size={14} /></button>
        </form>
      )}
      <div className="tiny hint">rejected scans alert the door lead automatically · duplicate QRs show when &amp; where the first scan happened</div>
    </div>
  );
}
