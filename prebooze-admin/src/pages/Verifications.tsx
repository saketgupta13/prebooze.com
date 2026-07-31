import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag } from '../components/ui';
import { stripHtml } from '../store/data';
import { liveKyc, resolveDocUrl, LiveApiError, type LiveKycApplication } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { downloadFile } from '../lib/download';

const TITLE = 'Verifications';
const KIND_ICON: Record<string, string> = { organizer: '🧑‍💼', promoter: '📣', lineup: '🎤', venue: '📍' };
const KIND_LABEL: Record<string, string> = { organizer: 'Organizer', promoter: 'Promoter', lineup: 'Line-up', venue: 'Venue' };

function DocumentModal({ doc, onClose }: { doc: { type: string; path: string }; onClose: () => void }) {
  const url = resolveDocUrl(doc.path);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 520, padding: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b>{doc.type}</b>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <img src={url} alt={doc.type} style={{ width: '100%', borderRadius: 8 }} />
        <button type="button" className="btn btn-pri btn-sm" style={{ marginTop: 10 }} onClick={() => downloadFile(url, `${doc.type}${url.slice(url.lastIndexOf('.'))}`)}>
          ⬇ Download
        </button>
      </div>
    </div>
  );
}

/** Real manual verification queue — every organizer/promoter/lineup/venue
 * signup is reviewed here by a human before it becomes a live entity. Guest
 * ID verification is automatic (KycService.submitGuest) and never appears
 * in this queue. */
export default function Verifications() {
  const session = useLiveSession();
  const { token } = session;

  const [apps, setApps] = useState<LiveKycApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [kindF, setKindF] = useState<'All' | LiveKycApplication['kind']>('All');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{ type: string; path: string } | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    liveKyc
      .list()
      .then(setApps)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const pendingCount = apps.filter((a) => a.status === 'pending').length;
  const list = apps.filter((a) => a.status === tab).filter((a) => kindF === 'All' || a.kind === kindF);

  const approve = async (id: string) => {
    try {
      await liveKyc.approve(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to approve');
    }
  };

  const submitReject = async (app: LiveKycApplication) => {
    if (!reason.trim()) return;
    try {
      await liveKyc.reject(app.id, reason.trim());
      setRejecting(null);
      setReason('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reject');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="page-title">Verifications</h1>
          {pendingCount > 0 && (
            <span className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 700 }}>
              {pendingCount} awaiting review
            </span>
          )}
        </div>
        <div className="tiny hint">
          Guests are verified automatically (ID + selfie). Organizers, promoters, line-ups and venues are always
          reviewed manually here — approving creates the live entity in its directory.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="tabs">
          {(['pending', 'approved', 'rejected'] as const).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <select className="input" style={{ maxWidth: 160 }} value={kindF} onChange={(e) => setKindF(e.target.value as 'All' | LiveKycApplication['kind'])}>
          <option value="All">All roles</option>
          <option value="organizer">Organizer</option>
          <option value="promoter">Promoter</option>
          <option value="lineup">Line-up</option>
          <option value="venue">Venue</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty">No {tab} applications.</div>
      ) : (
        <div className="stack">
          {list.map((app) => (
            <div key={app.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {KIND_ICON[app.kind]}{' '}
                    <Link to={`/verifications/${app.id}`} style={{ color: 'inherit' }}>{app.user.name || app.user.phone}</Link>
                    <span className="tiny muted"> · {KIND_LABEL[app.kind]}</span>
                  </div>
                  <div className="tiny muted">
                    {app.user.phone}
                    {app.user.email ? ` · ${app.user.email}` : ''} · submitted {new Date(app.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
                {app.status === 'approved' && <Tag label="Approved" cls="tag-green" />}
                {app.status === 'rejected' && <Tag label="Rejected" cls="tag-red" />}
                {app.status === 'pending' && <Tag label="Pending review" cls="tag-amber" />}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                {Object.entries(app.payload).map(([k, v]) => {
                  // "about"/"bio" is real WysiwygEditor HTML, not plain text
                  // (see VerificationDetail.tsx) — this is a compact, one-line
                  // summary row, so strip tags and truncate rather than
                  // showing either literal markup or a full multi-paragraph
                  // write-up inline next to every other field.
                  const isRichText = k === 'about' || k === 'bio';
                  const text = isRichText ? stripHtml(String(v)) : String(v);
                  const display = isRichText && text.length > 80 ? `${text.slice(0, 80)}…` : text;
                  return (
                    <span key={k} className="muted">
                      <b style={{ color: 'var(--text, inherit)' }}>{k}:</b> {display}
                    </span>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {app.documents.map((d, i) => (
                  <button
                    key={`${d.type}-${i}`}
                    type="button"
                    className="chip"
                    title="Click to preview & download"
                    onClick={() => setPreviewDoc(d)}
                  >
                    📄 {d.type}
                  </button>
                ))}
                <Link to={`/verifications/${app.id}`} className="chip">View full application →</Link>
              </div>

              {app.status === 'rejected' && app.reviewNote && (
                <div className="tiny" style={{ color: 'var(--red)' }}>Rejected: {app.reviewNote}</div>
              )}

              {app.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-pri btn-sm" onClick={() => approve(app.id)}>
                    ✓ Approve &amp; activate
                  </button>
                  {rejecting === app.id ? (
                    <>
                      <input
                        className="input"
                        style={{ flex: 1, minWidth: 200 }}
                        placeholder="Reason for rejection…"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                      />
                      <button className="btn btn-danger btn-sm" disabled={!reason.trim()} onClick={() => submitReject(app)}>
                        Confirm reject
                      </button>
                      <button className="btn btn-sm" onClick={() => { setRejecting(null); setReason(''); }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-danger btn-sm" onClick={() => setRejecting(app.id)}>
                      ✕ Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {previewDoc && <DocumentModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}
