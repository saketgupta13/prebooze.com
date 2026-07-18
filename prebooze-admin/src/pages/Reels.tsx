import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';

/** Reels — videos for the guest "Things happening at events" slider. */
export default function Reels() {
  const { reels, addReel, toggleReel, removeReel } = useAdmin();
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    addReel(title);
    setTitle('');
    setPicked(false);
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <div className="page-hd">
        <h1 className="page-title">Reels</h1>
        <span className="small muted">{reels.filter((r) => r.active).length} live in the guest slider</span>
      </div>

      <form className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={submit}>
        <button
          type="button"
          className="ph"
          style={{ height: 96, width: 84, borderRadius: 8, cursor: 'pointer', background: picked ? 'rgba(139,195,74,.1)' : undefined, borderColor: picked ? 'var(--green)' : undefined, color: picked ? 'var(--green)' : undefined, fontSize: 10.5 }}
          onClick={() => setPicked((v) => !v)}
        >
          {picked ? '✓ video ready 9:16' : '⬆ upload video 9:16 · ≤50 MB'}
        </button>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Caption</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Warehouse drop — crowd goes off" />
        </div>
        <button className="btn btn-pri" style={{ height: 38 }} disabled={!picked}>+ Publish reel</button>
      </form>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 520 }}>
          <span style={{ width: 56 }} />
          <span style={{ flex: 2 }}>Caption</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1 }} />
        </div>
        {reels.map((r) => (
          <div key={r.id} className="trow" style={{ minWidth: 520, opacity: r.active ? 1 : 0.55 }}>
            <span style={{ width: 56 }}>
              <span style={{ display: 'inline-flex', width: 40, height: 56, borderRadius: 6, alignItems: 'center', justifyContent: 'center', background: `radial-gradient(ellipse at 30% 25%, hsla(${r.hue},70%,55%,.4), transparent 60%), rgba(255,255,255,.04)` }}>▶</span>
            </span>
            <span style={{ flex: 2, fontWeight: 700 }}>{r.title}</span>
            <span style={{ flex: 1 }}>
              <button className="chip" style={{ fontSize: 10.5, padding: '3px 10px', borderColor: r.active ? 'var(--green)' : 'var(--red)', color: r.active ? undefined : 'var(--red)' }} onClick={() => toggleReel(r.id)}>
                {r.active ? 'Live' : 'Hidden'}
              </button>
            </span>
            <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => removeReel(r.id)}>✕</button>
            </span>
          </div>
        ))}
      </div>
      <div className="tiny hint">live reels play in the guest home “Things happening at events” slider · 9:16 vertical · ≤50 MB</div>
    </div>
  );
}
