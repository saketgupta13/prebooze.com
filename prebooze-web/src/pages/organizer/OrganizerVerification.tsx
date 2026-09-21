import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { organizer, kyc } from '../../api';
import { ApiError } from '../../api/client';
import { FileDropBox } from '../../components/FileDropBox';
import { dataUrlToFile } from '../../lib/fileUtils';
import Loader from '../../components/Loader';
import type { Organizer } from '../../types';
import { BadgeCheck, ShieldCheck, X, Check, ArrowLeft, ArrowRight, IdCard, FileText, Camera, Lock, AlertTriangle } from 'lucide-react';

const CONTACT_ROLES = ['Owner', 'Manager', 'Accountant', 'Other'] as const;
type ContactRole = (typeof CONTACT_ROLES)[number];

// Copy tailored per document type for the rejected/resubmit state —
// "re-upload" reads oddly for a selfie, which is really "please retake."
const DOC_TYPE_LABEL: Record<string, string> = {
  aadhaar: 'Aadhaar card',
  registration: 'Business registration',
  ownerAadhaar: "Owner's Aadhaar card",
  selfie: 'Selfie',
};

interface KycSubmission {
  id: string; kind: string; status: string; createdAt: string; reviewNote?: string;
  documents: { type: string; path: string }[];
  rejectedDocTypes: string[];
  payload: Record<string, unknown>;
}

/** Self-serve *identity* verification — badge-only, entirely separate from
 * payout details (see PaymentProfiles.tsx). There's no API to check an
 * Aadhaar number against, so this collects actual documents for a human
 * reviewer instead of a typed number: an individual uploads their own
 * Aadhaar card, a firm uploads its registration document plus the owner's
 * Aadhaar card — a selfie is required either way. Also records who's
 * actually submitting this (name/phone/email/role), since it may not be the
 * account owner. Submits into the same admin Verifications queue every
 * other role's KYC already goes through — see KycService.
 * submitOrganizerVerification / approve().
 *
 * Rejected-resubmission flow (2026-09-19 — a real bug: an organizer whose
 * submission staff had just rejected saw nothing at all, just a blank form
 * again with no reason and every field/document wiped). On the latest
 * submission being 'rejected': show the reviewer's reason up top, pre-fill
 * every non-document field from that submission's payload, and per document
 * only make the ones staff actually flagged (rejectedDocTypes) show as
 * needing a fresh file — anything NOT flagged is carried forward
 * server-side by referencing the already-stored file (see
 * previousSubmissionId in kyc.submitOrganizerVerification), so the
 * organizer only has to touch what was actually wrong. Faithful port of
 * prebooze-organizer's VerificationScreen.tsx — same reasoning throughout. */
export default function OrganizerVerification() {
  const navigate = useNavigate();
  const [org, setOrg] = useState<Organizer | null>(null);
  const [latestSub, setLatestSub] = useState<KycSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const [entityType, setEntityType] = useState<'individual' | 'firm' | ''>('');
  const [aadhaar, setAadhaar] = useState('');
  const [registration, setRegistration] = useState('');
  const [ownerAadhaar, setOwnerAadhaar] = useState('');
  const [selfie, setSelfie] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState<ContactRole | ''>('');
  const [contactRoleOther, setContactRoleOther] = useState('');
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([organizer.me(), kyc.myStatus()])
      .then(([o, submissions]) => {
        setOrg(o);
        setLatestSub((submissions.find((s) => s.kind === 'organizer') as KycSubmission | undefined) ?? null);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const rejectedSub = latestSub?.status === 'rejected' ? latestSub : null;
  const pending = latestSub?.status === 'pending';

  // Pre-fill once per rejected submission (not every render) — editing a
  // field shouldn't have it stomped back to the old value on a later render.
  if (rejectedSub && prefilledFor !== rejectedSub.id) {
    const p = rejectedSub.payload;
    if (typeof p.entityType === 'string') setEntityType(p.entityType as 'individual' | 'firm');
    setContactName(typeof p.contactName === 'string' ? p.contactName : '');
    setContactPhone(typeof p.contactPhone === 'string' ? p.contactPhone : '');
    setContactEmail(typeof p.contactEmail === 'string' ? p.contactEmail : '');
    setContactRole((typeof p.contactRole === 'string' ? p.contactRole : '') as ContactRole | '');
    setContactRoleOther(typeof p.contactRoleOther === 'string' ? p.contactRoleOther : '');
    setPrefilledFor(rejectedSub.id);
  }

  const rejectedTypes = new Set(rejectedSub?.rejectedDocTypes ?? []);
  const providedTypes = new Set((rejectedSub?.documents ?? []).map((d) => d.type));
  // A required doc is satisfied either by a freshly picked local file, or —
  // only when resubmitting — by being on file already and not one of the
  // ones staff flagged.
  const satisfied = (type: string, local: string) => !!local || (!!rejectedSub && providedTypes.has(type) && !rejectedTypes.has(type));

  const docsValid = entityType === 'individual'
    ? satisfied('aadhaar', aadhaar)
    : entityType === 'firm'
    ? satisfied('registration', registration) && satisfied('ownerAadhaar', ownerAadhaar)
    : false;
  const contactValid = contactName.trim() && contactPhone.trim() && contactEmail.trim() && contactRole && (contactRole !== 'Other' || contactRoleOther.trim());
  const valid = !!entityType && docsValid && satisfied('selfie', selfie) && contactValid;

  const submit = async () => {
    setErr('');
    setSubmitting(true);
    try {
      const slots = entityType === 'individual'
        ? [{ type: 'aadhaar', value: aadhaar }, { type: 'selfie', value: selfie }]
        : [{ type: 'registration', value: registration }, { type: 'ownerAadhaar', value: ownerAadhaar }, { type: 'selfie', value: selfie }];
      // Only freshly-picked files are actually uploaded — anything left
      // blank here that isn't flagged gets carried forward server-side via
      // previousSubmissionId, so an organizer touching just the one bad
      // document doesn't have to re-pick everything else.
      const fresh = slots.filter((s) => !!s.value);
      const docLabels = fresh.map((s) => s.type);
      const docs = await Promise.all(fresh.map((s) => dataUrlToFile(s.value, `${s.type}.jpg`)));
      await kyc.submitOrganizerVerification(
        {
          entityType: entityType as 'individual' | 'firm',
          contactName: contactName.trim(), contactPhone: contactPhone.trim(), contactEmail: contactEmail.trim(),
          contactRole: contactRole as ContactRole, contactRoleOther: contactRole === 'Other' ? contactRoleOther.trim() : undefined,
          docLabels, previousSubmissionId: rejectedSub?.id,
        },
        docs,
      );
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to submit — try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;
  if (!org) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  if (org.verified) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="bold" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>You're verified <span className="verified" style={{ display: 'inline-flex', alignItems: 'center' }}><BadgeCheck size={15} /></span></div>
        <p className="muted small">Your identity has been verified.</p>
        <Link to="/organizer/settings" className="link small bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10 }}><ArrowLeft size={13} /> Back to Settings</Link>
      </div>
    );
  }

  if (pending || done) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="bold" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={16} /> Verification under review</div>
        <p className="muted small">
          We've got your details — our team usually reviews within 24h. You'll get a WhatsApp/email once you're verified.
        </p>
        <Link to="/organizer/settings" className="link small bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10 }}><ArrowLeft size={13} /> Back to Settings</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Complete verification</h1>
        <Link to="/organizer/settings" className="link small bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><ArrowLeft size={13} /> Back to Settings</Link>
      </div>

      {rejectedSub && (
        <div className="card" style={{ marginBottom: 16, maxWidth: 640, borderColor: 'var(--danger)', background: 'rgba(255,92,73,.08)' }}>
          <div className="bold" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}><AlertTriangle size={16} /> Verification rejected</div>
          {!!rejectedSub.reviewNote && <p className="small" style={{ marginTop: 6 }}>{rejectedSub.reviewNote}</p>}
          {rejectedTypes.size > 0 && (
            <p className="tiny muted" style={{ marginTop: 6 }}>
              Please fix: {[...rejectedTypes].map((t) => DOC_TYPE_LABEL[t] ?? t).join(', ')}. Everything else you sent is kept — no need to redo it.
            </p>
          )}
        </div>
      )}

      <p className="muted small" style={{ marginBottom: 18 }}>
        Identity verification only — gets you the <span className="verified" style={{ display: 'inline-flex', alignItems: 'center' }}><BadgeCheck size={13} /></span> verified badge. Doesn't affect withdrawals; add a payment profile for that in Settings.
      </p>

      <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
        <h3 style={{ marginBottom: 12 }}>Who are we verifying?</h3>
        <div className="chip-row">
          <button type="button" className={`chip ${entityType === 'individual' ? 'on' : ''}`} onClick={() => setEntityType('individual')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Individual{entityType === 'individual' ? <Check size={12} /> : ''}
          </button>
          <button type="button" className={`chip ${entityType === 'firm' ? 'on' : ''}`} onClick={() => setEntityType('firm')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Firm / Company / LLP{entityType === 'firm' ? <Check size={12} /> : ''}
          </button>
        </div>
      </div>

      {entityType && (() => {
        // Per-document visual state for the rejected-resubmit flow: a
        // flagged doc (staff said this one's the problem) gets a red border
        // and "retake"/"re-upload" copy; a kept one (carried forward, not
        // flagged) gets a green border and "kept from before" copy — same
        // states as prebooze-organizer's DocBox. Neither applies outside a
        // rejected resubmission, so a first-time submission looks unchanged.
        const boxProps = (type: string, freshValue: string, doneLabel: React.ReactNode) => {
          const flagged = rejectedTypes.has(type);
          const kept = satisfied(type, freshValue) && !freshValue;
          return {
            style: { marginBottom: 12, ...(flagged && !freshValue ? { borderColor: 'var(--danger)' } : kept ? { borderColor: 'var(--success)' } : {}) },
            doneLabel,
            // Only overrides the explicit per-type `label` prop for the
            // "kept from before" state — the flagged state's label is
            // already set correctly per document type at each call site
            // below (e.g. "Retake selfie" vs "Re-upload Aadhaar card").
            ...(kept ? { label: <><Check size={13} color="var(--success)" /> Kept from before — click to replace</> } : {}),
          };
        };
        return (
          <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
            <h3 style={{ marginBottom: 4 }}>Documents</h3>
            <p className="tiny muted" style={{ marginBottom: 12 }}>
              We don't have a way to validate these automatically — a real person on our team reviews them.
            </p>
            {entityType === 'individual' ? (
              <FileDropBox
                value={aadhaar} onChange={setAadhaar} accept="image/*,.pdf"
                label={rejectedTypes.has('aadhaar') ? <>Re-upload Aadhaar card</> : <><IdCard size={14} /> Upload your Aadhaar card</>}
                {...boxProps('aadhaar', aadhaar, <><Check size={13} /> Aadhaar uploaded — click to replace</>)}
              />
            ) : (
              <>
                <FileDropBox
                  value={registration} onChange={setRegistration} accept="image/*,.pdf"
                  label={rejectedTypes.has('registration') ? <>Re-upload registration document</> : <><FileText size={14} /> Upload your business registration document</>}
                  {...boxProps('registration', registration, <><Check size={13} /> Registration doc uploaded — click to replace</>)}
                />
                <FileDropBox
                  value={ownerAadhaar} onChange={setOwnerAadhaar} accept="image/*,.pdf"
                  label={rejectedTypes.has('ownerAadhaar') ? <>Re-upload owner's Aadhaar card</> : <><IdCard size={14} /> Upload the owner's Aadhaar card</>}
                  {...boxProps('ownerAadhaar', ownerAadhaar, <><Check size={13} /> Owner's Aadhaar uploaded — click to replace</>)}
                />
              </>
            )}
            <FileDropBox
              value={selfie} onChange={setSelfie}
              label={rejectedTypes.has('selfie') ? <>Retake selfie</> : <><Camera size={14} /> capture or upload a selfie</>}
              {...boxProps('selfie', selfie, <><Check size={13} /> Selfie captured — click to replace</>)}
            />
          </div>
        );
      })()}

      <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
        <h3 style={{ marginBottom: 4 }}>Who's submitting this?</h3>
        <p className="tiny muted" style={{ marginBottom: 12 }}>
          Not always the owner — tell us who we're talking to and their role.
        </p>
        <div className="form-row">
          <div className="field">
            <span>Name *</span>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="field">
            <span>Phone *</span>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <span>Email *</span>
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" />
          </div>
          <div className="field">
            <span>Role *</span>
            <select value={contactRole} onChange={(e) => setContactRole(e.target.value as ContactRole)}>
              <option value="">Select…</option>
              {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        {contactRole === 'Other' && (
          <div className="field">
            <span>Describe the role *</span>
            <input value={contactRoleOther} onChange={(e) => setContactRoleOther(e.target.value)} placeholder="e.g. Marketing lead" />
          </div>
        )}
      </div>

      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}
      <div style={{ display: 'flex', gap: 10, maxWidth: 640 }}>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={15} /> Back</button>
        <button className="btn btn-pri btn-lg" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={!valid || submitting} onClick={submit}>
          {submitting ? 'Submitting…' : <>Submit for verification <ArrowRight size={15} /></>}
        </button>
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}><Lock size={12} /> reviewed manually by our team · usually approved within 24h</div>
    </div>
  );
}
