import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Tag } from '../components/ui';
import { liveKyc, liveMedia, resolveDocUrl, LiveApiError, type LiveKycApplication } from '../lib/liveApi';
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
  const [verifForm, setVerifForm] = useState({ gstin: '', pan: '', bankName: '', bankAccount: '', accountHolderName: '', bankIfsc: '' });
  const [verifSaving, setVerifSaving] = useState(false);
  const [verifSaved, setVerifSaved] = useState(false);
  const [docLabel, setDocLabel] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);

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

  // Pre-fill from whatever's already in the payload — non-empty for a
  // self-serve applicant who already provided these themselves (shown for
  // reference/correction), empty for a sales-assisted application until the
  // verification team fills them in here.
  useEffect(() => {
    const found = apps.find((a) => a.id === id);
    if (!found) return;
    const p = found.payload;
    setVerifForm({
      gstin: typeof p.gstin === 'string' ? p.gstin : '',
      pan: typeof p.pan === 'string' ? p.pan : '',
      bankName: typeof p.bankName === 'string' ? p.bankName : '',
      bankAccount: typeof p.bankAccount === 'string' ? p.bankAccount : '',
      accountHolderName: typeof p.accountHolderName === 'string' ? p.accountHolderName : '',
      bankIfsc: typeof p.bankIfsc === 'string' ? p.bankIfsc : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, apps.length]);

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

  const saveVerifDetails = async () => {
    if (!app) return;
    setVerifSaving(true);
    setVerifSaved(false);
    setErr('');
    try {
      await liveKyc.addVerificationDetails(app.id, verifForm);
      setVerifSaved(true);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    } finally {
      setVerifSaving(false);
    }
  };

  const uploadDoc = async () => {
    if (!app || !docFile) return;
    setDocUploading(true);
    setErr('');
    try {
      const { url } = await liveMedia.upload(docFile);
      await liveKyc.addDocuments(app.id, [{ type: docLabel.trim() || docFile.name, path: url }]);
      setDocLabel('');
      setDocFile(null);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to upload document');
    } finally {
      setDocUploading(false);
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
        {Object.entries(app.payload).map(([k, v]) =>
          // "about"/"bio" are the applicant's WysiwygEditor field on every
          // onboarding form (organizer/venue call it "about", promoter/
          // lineup call it "bio") — real HTML, not plain text. Rendering it
          // through the same {String(v)} path as every other plain payload
          // field (name, city, links…) showed the raw <p>/<strong> tags
          // literally to the reviewer instead of the formatted write-up.
          k === 'about' || k === 'bio' ? (
            <div key={k} style={{ borderBottom: '1px solid rgba(139,195,74,.08)', padding: '6px 0' }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{k}</div>
              <div className="small wysiwyg-body" dangerouslySetInnerHTML={{ __html: String(v) }} />
            </div>
          ) : (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(139,195,74,.08)', padding: '6px 0' }}>
              <span className="muted">{k}</span>
              <span>{String(v)}</span>
            </div>
          )
        )}
      </div>

      {app.kind === 'organizer' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="display" style={{ fontWeight: 700 }}>Verification details</div>
          <div className="tiny muted">
            {app.payload.leadId
              ? "Collected by calling the applicant — the lead team never fills these in. Required before this can be approved."
              : 'The applicant already provided these at submission — shown here for reference, editable if a correction is needed.'}
          </div>
          <div className="form-row">
            <div className="field">
              <label>GSTIN</label>
              <input className="input" value={verifForm.gstin} onChange={(e) => setVerifForm({ ...verifForm, gstin: e.target.value })} />
            </div>
            <div className="field">
              <label>PAN</label>
              <input className="input" value={verifForm.pan} onChange={(e) => setVerifForm({ ...verifForm, pan: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Bank name</label>
            <input className="input" value={verifForm.bankName} onChange={(e) => setVerifForm({ ...verifForm, bankName: e.target.value })} />
          </div>
          <div className="field">
            <label>Account holder name</label>
            <input className="input" value={verifForm.accountHolderName} onChange={(e) => setVerifForm({ ...verifForm, accountHolderName: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Account number</label>
              <input className="input" value={verifForm.bankAccount} onChange={(e) => setVerifForm({ ...verifForm, bankAccount: e.target.value })} />
            </div>
            <div className="field">
              <label>IFSC</label>
              <input className="input" value={verifForm.bankIfsc} onChange={(e) => setVerifForm({ ...verifForm, bankIfsc: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-pri btn-sm" disabled={verifSaving} onClick={saveVerifDetails}>
              {verifSaving ? 'Saving…' : 'Save details'}
            </button>
            {verifSaved && <span className="tiny green">Saved ✓</span>}
          </div>
        </div>
      )}

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
          {app.documents.length === 0 && <div className="tiny muted">No documents on file yet.</div>}
        </div>
        {app.status === 'pending' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(139,195,74,.08)', paddingTop: 10 }}>
            <input
              className="input"
              style={{ maxWidth: 180 }}
              placeholder="e.g. GST certificate"
              value={docLabel}
              onChange={(e) => setDocLabel(e.target.value)}
            />
            <input type="file" accept="image/*,.pdf" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            <button className="btn btn-ghost btn-sm" disabled={!docFile || docUploading} onClick={uploadDoc}>
              {docUploading ? 'Uploading…' : '+ Add document'}
            </button>
          </div>
        )}
      </div>

      {app.status === 'pending' && (() => {
        const p = app.payload;
        const missing = app.kind === 'organizer' && p.leadId
          ? [
              !p.gstin && 'GSTIN',
              !p.pan && 'PAN',
              !p.bankAccount && 'bank account number',
              !p.bankIfsc && 'IFSC',
              !p.bankName && 'bank name',
              !p.accountHolderName && 'account holder name',
              !app.documents.length && 'a KYC document',
            ].filter((x): x is string => Boolean(x))
          : [];
        return (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {missing.length > 0 && (
              <div className="tiny" style={{ color: '#d99a2b' }}>
                Can't approve yet — still missing: {missing.join(', ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-pri" style={{ flex: 1 }} disabled={missing.length > 0} onClick={approve}>
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
        );
      })()}
    </div>
  );
}
