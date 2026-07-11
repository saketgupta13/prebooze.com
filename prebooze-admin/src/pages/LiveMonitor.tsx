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
  const [panel, setPanel] = useState<'none' | 'checkin' | 'message'>('none');
  const [ciName, setCiName] = useState('');
  const [ciCount, setCiCount] = useState(1);
  const [msgTo, setMsgTo] = useState('All gate staff');
  const [msgText, setMsgText] = useState('');
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
          className={panel === 'checkin' ? 'btn btn-pri' : 'btn btn-ghost'}
          style={{ flex: 1 }}
          onClick={() => setPanel(panel === 'checkin' ? 'none' : 'checkin')}
        >
          Manual check-in
        </button>
        <button
          className={panel === 'message' ? 'btn btn-pri' : 'btn btn-ghost'}
          style={{ flex: 1 }}
          onClick={() => setPanel(panel === 'message' ? 'none' : 'message')}
        >
          Message staff
        </button>
      </div>

      {panel === 'checkin' && (
        <form
          className="card fade"
          style={{ border: '1px solid var(--green)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!ciName.trim()) {
              toast('Enter the guest name or booking #');
              return;
            }
            setCheckedIn((c) => c + ciCount);
            setFeed((f) =>
              [{ ok: true, text: `✓ ${ciName.trim()} ×${ciCount} · manual check-in · Gate A`, at: Date.now() }, ...f].slice(0, 8)
            );
            toast(`${ciName.trim()} checked in manually (${ciCount}) ✓`);
            setCiName('');
            setCiCount(1);
            setPanel('none');
          }}
        >
          <div className="field" style={{ flex: 1.6, minWidth: 160 }}>
            <label>Guest name or booking #</label>
            <input className="input" value={ciName} onChange={(e) => setCiName(e.target.value)} placeholder="e.g. Sam Rivera or #8412" autoFocus />
          </div>
          <div className="field" style={{ width: 130 }}>
            <label>Guests</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCiCount((c) => Math.max(1, c - 1))}>−</button>
              <b>{ciCount}</b>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCiCount((c) => Math.min(10, c + 1))}>+</button>
            </div>
          </div>
          <button type="submit" className="btn btn-pri" style={{ height: 38 }}>Check in ✓</button>
        </form>
      )}

      {panel === 'message' && (
        <form
          className="card fade"
          style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!msgText.trim()) {
              toast('Type a message first');
              return;
            }
            toast(`Message sent to ${msgTo} ✓`);
            setFeed((f) => [{ ok: true, text: `📣 to ${msgTo}: “${msgText.trim().slice(0, 40)}${msgText.trim().length > 40 ? '…' : ''}”`, at: Date.now() }, ...f].slice(0, 8));
            setMsgText('');
            setPanel('none');
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['All gate staff', 'Gate A crew', 'Gate B crew', 'Door lead'].map((t) => (
              <button key={t} type="button" className={`chip ${msgTo === t ? 'on' : ''}`} onClick={() => setMsgTo(t)}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="e.g. Hold entries 5 min — clearing the lobby"
              autoFocus
            />
            <button type="submit" className="btn btn-pri">Send 📣</button>
          </div>
          <div className="tiny hint">delivered to staff phones via WhatsApp · quick sends: “Slow the queue” · “VIP arriving” · “Last entry closing”</div>
        </form>
      )}
      <div className="tiny hint">rejected scans alert the door lead automatically · duplicate QRs show when & where the first scan happened</div>
    </div>
  );
}
