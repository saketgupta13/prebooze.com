import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { CityFilterDropdown, Tag } from '../components/ui';
import { enabledCityNames, placeholderDocImage } from '../store/data';
import type { KycApplication, KycKind } from '../types';

const KIND_ICON: Record<KycKind, string> = { organizer: '🧑‍💼', promoter: '📣', lineup: '🎤', venue: '📍' };
const KIND_LABEL: Record<KycKind, string> = { organizer: 'Organizer', promoter: 'Promoter', lineup: 'Line-up', venue: 'Venue' };

/** Real document previewer + download — no real backend/uploads exist in
 * this mock, so a generated placeholder image stands in for the real file
 * a live KYC submission would have (same "give it something real to hold"
 * reasoning as everywhere else images were faked before). */
function DocumentModal({ doc, onClose }: { doc: { type: string; note: string }; onClose: () => void }) {
  const url = placeholderDocImage(doc.type, doc.note);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 520, padding: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b>{doc.type}</b>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <img src={url} alt={doc.type} style={{ width: '100%', borderRadius: 8 }} />
        <div className="tiny muted" style={{ marginTop: 8 }}>{doc.note}</div>
        <a href={url} download={`${doc.type.replace(/\s+/g, '-').toLowerCase()}.svg`} className="btn btn-pri btn-sm" style={{ marginTop: 10, display: 'inline-block' }}>
          ⬇ Download
        </a>
      </div>
    </div>
  );
}

/** Manual verification queue — every organizer/promoter/lineup/venue signup
 * is reviewed here by a human before it becomes a live entity. Guest ID
 * verification is automatic and never appears in this queue. */
export default function Verifications() {
  const { kycApplications, approveKycApplication, rejectKycApplication, locations } = useAdmin();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [kindF, setKindF] = useState<'All' | KycKind>('All');
  const [cityF, setCityF] = useState('All');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{ appId: string; type: string; note: string } | null>(null);
  const cities = enabledCityNames(locations);

  const pendingCount = kycApplications.filter((k) => k.status === 'pending').length;
  const list = kycApplications
    .filter((k) => k.status === tab)
    .filter((k) => kindF === 'All' || k.kind === kindF)
    .filter((k) => cityF === 'All' || k.city === cityF);

  const submitReject = (app: KycApplication) => {
    if (!reason.trim()) return;
    rejectKycApplication(app.id, reason.trim());
    setRejecting(null);
    setReason('');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
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
        <select className="input" style={{ maxWidth: 160 }} value={kindF} onChange={(e) => setKindF(e.target.value as 'All' | KycKind)}>
          <option value="All">All roles</option>
          <option value="organizer">Organizer</option>
          <option value="promoter">Promoter</option>
          <option value="lineup">Line-up</option>
          <option value="venue">Venue</option>
        </select>
        <CityFilterDropdown value={cityF} onChange={setCityF} cities={cities} />
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
                    <Link to={`/verifications/${app.id}`} style={{ color: 'inherit' }}>{app.applicantName}</Link>
                    <span className="tiny muted"> · {KIND_LABEL[app.kind]}</span>
                  </div>
                  <div className="tiny muted">{app.applicantPhone} · {app.city} · submitted {app.submittedAt}</div>
                </div>
                {app.status === 'approved' && <Tag label="Approved" cls="tag-green" />}
                {app.status === 'rejected' && <Tag label="Rejected" cls="tag-red" />}
                {app.status === 'pending' && <Tag label="Pending review" cls="tag-amber" />}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                {Object.entries(app.payload).map(([k, v]) => (
                  <span key={k} className="muted">
                    <b style={{ color: 'var(--text, inherit)' }}>{k}:</b> {v}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {app.documents.map((d) => (
                  <button
                    key={d.type}
                    type="button"
                    className="chip"
                    title="Click to preview & download"
                    onClick={() => setPreviewDoc({ appId: app.id, ...d })}
                  >
                    📄 {d.type} — {d.note}
                  </button>
                ))}
                <Link to={`/verifications/${app.id}`} className="chip">View full application →</Link>
              </div>

              {app.status === 'rejected' && app.reviewNote && (
                <div className="tiny" style={{ color: 'var(--red)' }}>Rejected: {app.reviewNote}</div>
              )}

              {app.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-pri btn-sm" onClick={() => approveKycApplication(app.id)}>
                    ✓ Approve & activate
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
