import { useEffect, useRef, useState } from 'react';
import { liveReels, liveMedia, LiveApiError, type LiveReel } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Reels';

/** Reels — videos for the guest "Things happening at events" slider. Real
 * Reel rows; the video itself is a real upload (MediaController), not a
 * localStorage blob. */
export default function Reels() {
  const session = useLiveSession();
  const { token } = session;

  const [reels, setReels] = useState<LiveReel[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    liveReels
      .list()
      .then(setReels)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const { url } = await liveMedia.upload(file);
      setVideoUrl(url);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) return;
    try {
      await liveReels.create({ title: title.trim(), videoUrl });
      setTitle('');
      setVideoUrl('');
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to publish reel');
    }
  };

  const toggle = async (id: string) => {
    try { await liveReels.toggle(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to update'); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Remove this reel?')) return;
    try { await liveReels.remove(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Reels</h1>
        <span className="small muted">{reels.filter((r) => r.active).length} live in the guest slider</span>
      </div>

      <form className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={submit}>
        <input ref={inputRef} type="file" accept="video/*" onChange={onFile} style={{ display: 'none' }} />
        {videoUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <video src={videoUrl} muted style={{ width: 90, height: (90 * 16) / 9, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--green)' }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}>Replace reel</button>
          </div>
        ) : (
          <button type="button" className="ph" style={{ height: 70, width: 220, cursor: 'pointer' }} disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? 'Uploading…' : '⬆ upload video 9:16 · ≤50 MB'}
          </button>
        )}
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Caption</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Warehouse drop — crowd goes off" />
        </div>
        <button className="btn btn-pri" style={{ height: 38 }} disabled={!videoUrl}>+ Publish reel</button>
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
              {r.videoUrl ? (
                <video src={r.videoUrl} muted style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 6 }} />
              ) : (
                <span style={{ display: 'inline-flex', width: 40, height: 56, borderRadius: 6, alignItems: 'center', justifyContent: 'center', background: `radial-gradient(ellipse at 30% 25%, hsla(${r.hue},70%,55%,.4), transparent 60%), rgba(255,255,255,.04)` }}>▶</span>
              )}
            </span>
            <span style={{ flex: 2, fontWeight: 700 }}>{r.title}</span>
            <span style={{ flex: 1 }}>
              <button className="chip" style={{ fontSize: 10.5, padding: '3px 10px', borderColor: r.active ? 'var(--green)' : 'var(--red)', color: r.active ? undefined : 'var(--red)' }} onClick={() => toggle(r.id)}>
                {r.active ? 'Live' : 'Hidden'}
              </button>
            </span>
            <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => remove(r.id)}>✕</button>
            </span>
          </div>
        ))}
        {reels.length === 0 && !loading && <div className="trow muted">No reels yet.</div>}
      </div>
      <div className="tiny hint">live reels play in the guest home "Things happening at events" slider · 9:16 vertical · ≤50 MB</div>
    </div>
  );
}
