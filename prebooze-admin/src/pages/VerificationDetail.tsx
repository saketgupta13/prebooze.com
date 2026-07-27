import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Tag } from '../components/ui';
import { liveKyc, resolveDocUrl, LiveApiError, type LiveKycApplication } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import { downloadFile } from '../lib/download';

const TITLE = 'Verification detail';
const KIND_ICON: Record<string, string> = { organizer: '🧑‍💼', promoter: '📣', lineup: '🎤', venue: '📍' };
const KIND_LABEL: Record<string, string> = { organizer: 'Organizer', promoter: 'Promoter', lineup: 'Line-up', venue: 'Venue' };

/** Full detail view for a single verification application — same real
 * KycService-backed queue as Verifications.tsx, just filtered to one id
 * (there's no single-item GET, so this reuses the list endpoint). */
export default function VerificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [apps, setApps] = useState<LiveKycApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

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

  const app = apps.find((a) => a.id === id);

  if (!loading && !app) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Application not found</h1>
        <Link to="/verifications" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Verifications</Link>
      </div>
    );
  }

  const approve = async () => {
    if (!app) return;
    try {
      await liveKyc.approve(app.id);
      navigate('/verifications');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to approve');
    }
  };

  const submitReject = async () => {
    if (!app || !reason.trim()) return;
    try {
      await liveKyc.reject(app.id, reason.trim());
      navigate('/verifications');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reject');
    }
  };

  if (!app) {
    return (
      <div className="stack fade">
        <div className="tiny muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className="stack fade" style={{ maxWidth: 720, gap: 14 }}>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/verifications" style={{ fontSize: 13 }}>← Verifications</Link>
        <h1 className="page-title">
          {KIND_ICON[app.kind]} {app.user.name || app.user.phone} <span className="tiny muted">· {KIND_LABEL[app.kind]}</span>
        </h1>
        {app.status === 'approved' && <Tag label="Approved" cls="tag-green" />}
        {app.status === 'rejected' && <Tag label="Rejected" cls="tag-red" />}
        {app.status === 'pending' && <Tag label="Pending review" cls="tag-amber" />}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Applicant</div>
        <div className="tiny muted">Phone: {app.user.phone}</div>
        {app.user.email && <div className="tiny muted">Email: {app.user.email}</div>}
        <div className="tiny muted">Submitted: {new Date(app.createdAt).toLocaleString('en-IN')}</div>
        {app.reviewedBy && <div className="tiny muted">Reviewed by: {app.reviewedBy}</div>}
        {app.reviewNote && <div className="tiny" style={{ color: app.status === 'rejected' ? 'var(--red)' : undefined }}>Note: {app.reviewNote}</div>}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Application details</div>
        {Object.entries(app.payload).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(139,195,74,.08)', padding: '6px 0' }}>
            <span className="muted">{k}</span>
            <span>{String(v)}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Documents</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {app.documents.map((d, i) => {
            const url = resolveDocUrl(d.path);
            return (
              <div key={`${d.type}-${i}`} style={{ width: 200 }}>
                <img src={url} alt={d.type} style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(139,195,74,.2)' }} />
                <div className="tiny" style={{ fontWeight: 700, marginTop: 4 }}>{d.type}</div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => downloadFile(url, `${d.type}${url.slice(url.lastIndexOf('.'))}`)}>
                  ⬇ Download
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {app.status === 'pending' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-pri" style={{ flex: 1 }} onClick={approve}>
              ✓ Approve &amp; activate
            </button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setRejecting((v) => !v)}>
              ✕ Reject
            </button>
          </div>
          {rejecting && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Reason for rejection…" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
              <button className="btn btn-danger btn-sm" disabled={!reason.trim()} onClick={submitReject}>Confirm</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
