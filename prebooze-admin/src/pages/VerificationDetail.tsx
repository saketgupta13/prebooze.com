import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { Tag } from '../components/ui';
import { placeholderDocImage } from '../store/data';

const KIND_ICON: Record<string, string> = { organizer: '🧑‍💼', promoter: '📣', lineup: '🎤', venue: '📍' };
const KIND_LABEL: Record<string, string> = { organizer: 'Organizer', promoter: 'Promoter', lineup: 'Line-up', venue: 'Venue' };

/** Full detail view for a single verification application — everything the
 * inline card on the list page shows plus a real per-document preview
 * (image + download) inline, not just a chip. */
export default function VerificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { kycApplications, approveKycApplication, rejectKycApplication } = useAdmin();
  const app = kycApplications.find((a) => a.id === id);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  if (!app) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Application not found</h1>
        <Link to="/verifications" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Verifications</Link>
      </div>
    );
  }

  const submitReject = () => {
    if (!reason.trim()) return;
    rejectKycApplication(app.id, reason.trim());
    navigate('/verifications');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 720, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/verifications" style={{ fontSize: 13 }}>← Verifications</Link>
        <h1 className="page-title">
          {KIND_ICON[app.kind]} {app.applicantName} <span className="tiny muted">· {KIND_LABEL[app.kind]}</span>
        </h1>
        {app.status === 'approved' && <Tag label="Approved" cls="tag-green" />}
        {app.status === 'rejected' && <Tag label="Rejected" cls="tag-red" />}
        {app.status === 'pending' && <Tag label="Pending review" cls="tag-amber" />}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Applicant</div>
        <div className="tiny muted">Phone: {app.applicantPhone}</div>
        <div className="tiny muted">City: {app.city}</div>
        <div className="tiny muted">Submitted: {app.submittedAt}</div>
        {app.reviewedBy && <div className="tiny muted">Reviewed by: {app.reviewedBy}</div>}
        {app.reviewNote && <div className="tiny" style={{ color: app.status === 'rejected' ? 'var(--red)' : undefined }}>Note: {app.reviewNote}</div>}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Application details</div>
        {Object.entries(app.payload).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(139,195,74,.08)', padding: '6px 0' }}>
            <span className="muted">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Documents</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {app.documents.map((d) => {
            const url = placeholderDocImage(d.type, d.note);
            return (
              <div key={d.type} style={{ width: 200 }}>
                <img src={url} alt={d.type} style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(139,195,74,.2)' }} />
                <div className="tiny" style={{ fontWeight: 700, marginTop: 4 }}>{d.type}</div>
                <div className="tiny muted">{d.note}</div>
                <a href={url} download={`${d.type.replace(/\s+/g, '-').toLowerCase()}.svg`} className="btn btn-ghost btn-sm" style={{ marginTop: 4, display: 'inline-block' }}>
                  ⬇ Download
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {app.status === 'pending' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-pri" style={{ flex: 1 }} onClick={() => { approveKycApplication(app.id); navigate('/verifications'); }}>
              ✓ Approve & activate
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
