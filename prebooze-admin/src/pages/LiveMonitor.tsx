import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { Kpi } from '../components/ui';

interface FeedEntry {
  ok: boolean;
  text: string;
  at: number; // epoch ms
}

const NAMES = ['Arjun M.', 'Nia T. +1', 'Priya K.', 'Sam R. +2', 'Rohan V.', 'Lena S.', 'Karan D. +3', 'Maya P.'];
const TIERS = ['General', 'VIP', 'Early bird'];
const GATES = ['Gate A', 'Gate B'];

const HISTOGRAM = [4, 9, 16, 28, 41, 38, 52, 44, 30, 18];

function ago(at: number) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

/** Real-time event-night ops screen — sketched in wireframe 1h, designed fully here.
 * Feed is simulated locally until the check-in websocket exists. */
export default function LiveMonitor() {
  const { id } = useParams();
  const { events, toast } = useAdmin();
  const event = events.find((e) => e.id === id) ?? events.find((e) => e.status === 'live');

  const [checkedIn, setCheckedIn] = useState(248);
  const [rejected, setRejected] = useState(2);
  const [scanRate, setScanRate] = useState(4);
  const [paused, setPaused] = useState(false);
  const [feed, setFeed] = useState<FeedEntry[]>([
    { ok: true, text: '✓ Arjun M. · General · Gate A', at: Date.now() - 4000 },
    { ok: true, text: '✓ Nia T. +1 · VIP · Gate B', at: Date.now() - 12000 },
    { ok: false, text: '✕ duplicate QR — already scanned 8:41 PM', at: Date.now() - 40000 },
  ]);
  const tick = useRef(0);

  // Simulated live feed — replace with websocket once the backend lands
  useEffect(() => {
    const t = setInterval(() => {
      tick.current += 1;
      const isReject = tick.current % 9 === 0;
      if (isReject) {
        setRejected((r) => r + 1);
        setFeed((f) => [{ ok: false, text: '✕ invalid QR — not found for this event', at: Date.now() }, ...f].slice(0, 8));
      } else {
        const name = NAMES[tick.current % NAMES.length];
        const plus = name.includes('+') ? parseInt(name.split('+')[1], 10) + 1 : 1;
        setCheckedIn((c) => c + plus);
        setFeed((f) => [
          {
            ok: true,
            text: `✓ ${name} · ${TIERS[tick.current % TIERS.length]} · ${GATES[tick.current % GATES.length]}`,
            at: Date.now(),
          },
          ...f,
        ].slice(0, 8));
      }
      setScanRate(3 + (tick.current % 4));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  if (!event) {
    return (
      <div className="stack fade">
        <h1 className="page-title">No live event right now</h1>
        <Link to="/events" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Events</Link>
      </div>
    );
  }

  const total = event.sold || 312;
  const remaining = Math.max(0, total - checkedIn);
  const pct = Math.min(100, Math.round((checkedIn / total) * 100));
  const maxBar = Math.max(...HISTOGRAM);

  return (
    <div className="stack fade" style={{ maxWidth: 760, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/events/${event.id}`} style={{ fontSize: 13 }}>← Event</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{event.title}</h1>
        <span className="tag tag-green">● LIVE</span>
        <div style={{ flex: 1 }} />
        <span className="tiny muted">refreshes every 5s · works on staff phones at the gate</span>
      </div>

      <div className="kpi-grid">
        <Kpi label="checked in" value={fmt(checkedIn)} delta={`${pct}% of ${fmt(total)}`} deltaColor="var(--muted)" />
        <Kpi label="yet to arrive" value={fmt(remaining)} />
        <Kpi label="scan rate" value={`${scanRate}/min`} />
        <Kpi label="rejected QRs" value={<span className="red">{rejected}</span>} alert />
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="small" style={{ fontWeight: 700 }}>Gate progress</span>
          <span className="tiny muted">{fmt(checkedIn)}/{fmt(total)} in</span>
        </div>
        <div style={{ height: 8, background: 'rgba(139,195,74,.15)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--green)', transition: 'width .4s' }} />
        </div>
      </div>

      <div className="card">
        <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Arrivals — by 15 min</div>
        <div className="bars" style={{ height: 70 }}>
          {HISTOGRAM.map((v, i) => (
            <div key={i} className="bar">
              <div style={{ height: `${(v / maxBar) * 100}%`, opacity: 0.4 + (v / maxBar) * 0.6 }} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Gate feed</div>
        <div className="stack" style={{ gap: 4 }}>
          {feed.map((f, i) => (
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
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className={paused ? 'btn btn-pri' : 'btn btn-danger'}
          style={{ flex: 1 }}
          onClick={() => {
            setPaused((p) => !p);
            toast(paused ? 'Gate sales resumed ✓' : 'Gate sales paused');
          }}
        >
          {paused ? 'Resume gate sales ✓' : 'Pause gate sales'}
        </button>
        <button
          className="btn btn-ghost"
          style={{ flex: 1 }}
          onClick={() => {
            setCheckedIn((c) => c + 1);
            setFeed((f) => [{ ok: true, text: '✓ manual check-in · walk-up · Gate A', at: Date.now() }, ...f].slice(0, 8));
            toast('Manual check-in recorded ✓');
          }}
        >
          Manual check-in
        </button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => toast('Message sent to 4 gate staff ✓')}>
          Message staff
        </button>
      </div>
      <div className="tiny hint">rejected scans alert the door lead automatically · duplicate QRs show when & where the first scan happened</div>
    </div>
  );
}
