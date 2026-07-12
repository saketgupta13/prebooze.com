import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { EVENTS } from '../../data/mock';

interface FeedEntry {
  ok: boolean;
  text: string;
  at: number;
}

const NAMES = ['Arjun M.', 'Nia T. +1', 'Priya K.', 'Sam R. +2', 'Rohan V.', 'Lena S.', 'Karan D. +3', 'Maya P.'];
const TIERS = ['General', 'VIP', 'Early bird'];
const GATES = ['Gate A', 'Gate B'];
const HIST = [4, 9, 16, 28, 41, 38, 52, 44, 30, 18];

function ago(at: number) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

/** Live gate monitor — full admin-parity version: scan rate, live feed with
 * timestamps, manual check-in form and message-staff composer. */
export default function OrgLiveMonitor() {
  const { myEvents, team, toast } = useApp();
  const orgEvents = [
    ...myEvents.filter((e) => e.status === 'approved'),
    ...EVENTS.filter((e) => e.organizerId === 'livewire' && e.status === 'approved' && !myEvents.some((m) => m.id === e.id)),
  ];
  const [eventId, setEventId] = useState(orgEvents[0]?.id ?? '');
  const event = orgEvents.find((e) => e.id === eventId);
  const [checkedIn, setCheckedIn] = useState(248);
  const [rejected, setRejected] = useState(1);
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

  useEffect(() => {
    const t = setInterval(() => {
      tick.current += 1;
      if (tick.current % 9 === 0) {
        setRejected((r) => r + 1);
        setFeed((f) => [{ ok: false, text: '✕ invalid QR — not found for this event', at: Date.now() }, ...f].slice(0, 8));
      } else {
        const n = NAMES[tick.current % NAMES.length];
        const plus = n.includes('+') ? parseInt(n.split('+')[1], 10) + 1 : 1;
        setCheckedIn((c) => c + plus);
        setFeed((f) =>
          [{ ok: true, text: `✓ ${n} · ${TIERS[tick.current % TIERS.length]} · ${GATES[tick.current % GATES.length]}`, at: Date.now() }, ...f].slice(0, 8)
        );
      }
      setScanRate(3 + (tick.current % 4));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  const total = event ? event.tiers.reduce((a, t) => a + t.sold, 0) || 312 : 312;
  const remaining = Math.max(0, total - checkedIn);
  const pct = Math.min(100, Math.round((checkedIn / total) * 100));
  const maxH = Math.max(...HIST);
  const audiences = ['All gate staff', ...team.filter((m) => m.scan && m.role !== 'Owner').map((m) => m.name), 'Gate A crew', 'Gate B crew'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24 }}>
          Live monitor <span className="badge badge-ok">● LIVE</span>
        </h1>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ maxWidth: 240 }}>
          {orgEvents.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>
      <div className="tiny muted-2" style={{ marginBottom: 16 }}>refreshes every 5s · works on staff phones at the gate</div>

      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="l">checked in</div><div className="v">{checkedIn}</div><div className="tiny muted">{pct}% of {total}</div></div>
        <div className="kpi"><div className="l">yet to arrive</div><div className="v">{remaining}</div></div>
        <div className="kpi"><div className="l">scan rate</div><div className="v">{scanRate}/min</div></div>
      </div>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi" style={{ borderColor: 'rgba(255,92,73,.4)' }}>
          <div className="l danger-text">rejected QRs</div>
          <div className="v danger-text">{rejected}</div>
        </div>
        <div className="kpi" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }} className="small">
            <span className="bold">Gate progress</span>
            <span className="muted">{checkedIn}/{total} in</span>
          </div>
          <div className="bar"><div style={{ width: `${pct}%`, transition: 'width .4s' }} /></div>
        </div>
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
        <button className={panel === 'checkin' ? 'btn btn-pri' : 'btn btn-ghost'} style={{ flex: 1 }} onClick={() => setPanel(panel === 'checkin' ? 'none' : 'checkin')}>
          Manual check-in
        </button>
        <button className={panel === 'message' ? 'btn btn-pri' : 'btn btn-ghost'} style={{ flex: 1 }} onClick={() => setPanel(panel === 'message' ? 'none' : 'message')}>
          Message staff
        </button>
      </div>

      {panel === 'checkin' && (
        <form
          className="card"
          style={{ borderColor: 'var(--accent)', marginBottom: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!ciName.trim()) {
              toast('Enter the guest name or booking #');
              return;
            }
            setCheckedIn((c) => c + ciCount);
            setFeed((f) => [{ ok: true, text: `✓ ${ciName.trim()} ×${ciCount} · manual check-in · Gate A`, at: Date.now() }, ...f].slice(0, 8));
            toast(`${ciName.trim()} checked in manually (${ciCount}) ✓`);
            setCiName('');
            setCiCount(1);
            setPanel('none');
          }}
        >
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
            <button className="btn btn-pri" style={{ flex: '0 0 auto' }}>Check in ✓</button>
          </div>
        </form>
      )}

      {panel === 'message' && (
        <form
          className="card"
          style={{ borderColor: 'var(--accent)', marginBottom: 12 }}
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
          <div className="chip-row" style={{ marginBottom: 10 }}>
            {audiences.map((t) => (
              <button key={t} type="button" className={`chip ${msgTo === t ? 'on' : ''}`} onClick={() => setMsgTo(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="form-row">
            <input value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="e.g. Hold entries 5 min — clearing the lobby" autoFocus />
            <button className="btn btn-pri" style={{ flex: '0 0 auto' }}>Send 📣</button>
          </div>
          <div className="tiny muted-2" style={{ marginTop: 8 }}>delivered to staff phones via WhatsApp · audiences come from your team with scan access</div>
        </form>
      )}

      <div className="tiny muted-2">rejected scans alert the door lead automatically · duplicate QRs show when the first scan happened</div>
    </div>
  );
}
