import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { EVENTS } from '../../data/mock';

const NAMES = ['Arjun M.', 'Nia T. +1', 'Priya K.', 'Sam R. +2', 'Rohan V.', 'Lena S.'];
const HIST = [4, 9, 16, 28, 41, 38, 52, 44, 30, 18];

/** Live gate monitor — organizer view of tonight's doors, same tool the admin has. */
export default function OrgLiveMonitor() {
  const { myEvents } = useApp();
  const orgEvents = [...myEvents.filter((e) => e.status === 'approved'), ...EVENTS.filter((e) => e.organizerId === 'livewire' && e.status === 'approved')];
  const [eventId, setEventId] = useState(orgEvents[0]?.id ?? '');
  const event = orgEvents.find((e) => e.id === eventId);
  const [checkedIn, setCheckedIn] = useState(248);
  const [rejected, setRejected] = useState(1);
  const [paused, setPaused] = useState(false);
  const [feed, setFeed] = useState<{ ok: boolean; text: string }[]>([
    { ok: true, text: '✓ Arjun M. · General · Gate A' },
    { ok: false, text: '✕ duplicate QR — already scanned 8:41 PM' },
  ]);
  const tick = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      tick.current += 1;
      if (tick.current % 8 === 0) {
        setRejected((r) => r + 1);
        setFeed((f) => [{ ok: false, text: '✕ invalid QR — not found for this event' }, ...f].slice(0, 6));
      } else {
        const n = NAMES[tick.current % NAMES.length];
        setCheckedIn((c) => c + (n.includes('+') ? 2 : 1));
        setFeed((f) => [{ ok: true, text: `✓ ${n} · General · Gate ${tick.current % 2 ? 'A' : 'B'}` }, ...f].slice(0, 6));
      }
    }, 3500);
    return () => clearInterval(t);
  }, []);

  const total = event ? event.tiers.reduce((a, t) => a + t.sold, 0) || 312 : 312;
  const pct = Math.min(100, Math.round((checkedIn / total) * 100));
  const maxH = Math.max(...HIST);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>Live monitor <span className="badge badge-ok">● LIVE</span></h1>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ maxWidth: 240 }}>
          {orgEvents.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="l">checked in</div><div className="v">{checkedIn}</div></div>
        <div className="kpi"><div className="l">yet to arrive</div><div className="v">{Math.max(0, total - checkedIn)}</div></div>
        <div className="kpi"><div className="l">rejected QRs</div><div className="v danger-text">{rejected}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }} className="small">
          <span className="bold">Gate progress</span>
          <span className="muted">{checkedIn}/{total} in · {pct}%</span>
        </div>
        <div className="bar"><div style={{ width: `${pct}%`, transition: 'width .4s' }} /></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="small bold" style={{ marginBottom: 8 }}>Arrivals — by 15 min</div>
        <div className="chart" style={{ height: 70 }}>
          {HIST.map((v, i) => (
            <div key={i} className="col" style={{ height: `${(v / maxH) * 100}%` }} />
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="small bold" style={{ marginBottom: 8 }}>Gate feed</div>
        {feed.map((f, i) => (
          <div
            key={i}
            className="small"
            style={{
              border: `1.5px solid ${f.ok ? 'var(--border-3)' : 'var(--danger)'}`,
              color: f.ok ? 'var(--text)' : 'var(--danger)',
              borderRadius: 7,
              padding: '5px 10px',
              marginBottom: 5,
            }}
          >
            {f.text}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className={paused ? 'btn btn-pri' : 'btn btn-danger'} onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume gate sales ✓' : 'Pause gate sales'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setCheckedIn((c) => c + 1);
            setFeed((f) => [{ ok: true, text: '✓ manual check-in · walk-up · Gate A' }, ...f].slice(0, 6));
          }}
        >
          Manual check-in
        </button>
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>refreshes every 5s · works on staff phones at the gate · scanner lives under 📷 Scanner</div>
    </div>
  );
}
