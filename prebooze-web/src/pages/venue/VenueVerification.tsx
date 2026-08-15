import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { venuePartner, kyc } from '../../api';
import { ApiError } from '../../api/client';
import { FileDropBox } from '../../components/FileDropBox';
import { dataUrlToFile } from '../../lib/fileUtils';
import Loader from '../../components/Loader';
import type { Venue } from '../../types';

const CONTACT_ROLES = ['Owner', 'Manager', 'Accountant', 'Other'] as const;
type ContactRole = (typeof CONTACT_ROLES)[number];

/** Self-serve *identity* verification — badge-only, entirely separate from
 * the venue's onboarding (which no longer collects any documents at all —
 * see VenueOnboarding.tsx). A venue is always a business, so unlike
 * organizer's this is a single shape: operating license + address proof,
 * plus who's submitting it (name/phone/email/role, since it may not be the
 * account owner). Submits into the same admin Verifications queue every
 * other role's KYC already goes through — see KycService.
 * submitVenueVerification / approve(). */
export default function VenueVerification() {
  const navigate = useNavigate();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const [license, setLicense] = useState('');
  const [addressProof, setAddressProof] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState<ContactRole | ''>('');
  const [contactRoleOther, setContactRoleOther] = useState('');

  useEffect(() => {
    Promise.all([venuePartner.myListing(), kyc.myStatus()])
      .then(([v, submissions]) => {
        setVenue(v);
        setPending(submissions.some((s) => s.kind === 'venue' && s.status === 'pending'));
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const contactValid = contactName.trim() && contactPhone.trim() && contactEmail.trim() && contactRole && (contactRole !== 'Other' || contactRoleOther.trim());
  const valid = !!license && !!addressProof && !!contactValid;

  const submit = async () => {
    setErr('');
    setSubmitting(true);
    try {
      const docLabels = ['license', 'address_proof'];
      const docs = await Promise.all([license, addressProof].map((d, i) => dataUrlToFile(d, `${docLabels[i]}.jpg`)));
      await kyc.submitVenueVerification(
        {
          contactName: contactName.trim(), contactPhone: contactPhone.trim(), contactEmail: contactEmail.trim(),
          contactRole: contactRole as ContactRole, contactRoleOther: contactRole === 'Other' ? contactRoleOther.trim() : undefined,
          docLabels,
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
  if (!venue) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  if (venue.verified) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="bold" style={{ marginBottom: 6 }}>You're verified <span className="verified">✓</span></div>
        <p className="muted small">Your venue's identity has been verified.</p>
        <Link to="/venue/settings" className="link small bold" style={{ display: 'inline-block', marginTop: 10 }}>← Back to Settings</Link>
      </div>
    );
  }

  if (pending || done) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="bold" style={{ marginBottom: 6 }}>🛡 Verification under review</div>
        <p className="muted small">
          We've got your details — our team usually reviews within 24h. You'll get a WhatsApp/email once you're verified.
        </p>
        <Link to="/venue/settings" className="link small bold" style={{ display: 'inline-block', marginTop: 10 }}>← Back to Settings</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Complete verification</h1>
        <Link to="/venue/settings" className="link small bold">← Back to Settings</Link>
      </div>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Identity verification only — gets you the <span className="verified">✓</span> verified badge. Your listing is
        already live and bookable either way.
      </p>

      <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
        <h3 style={{ marginBottom: 4 }}>Documents</h3>
        <p className="tiny muted" style={{ marginBottom: 12 }}>
          We don't have a way to validate these automatically — a real person on our team reviews them.
        </p>
        <FileDropBox value={license} onChange={setLicense} accept="image/*,.pdf" label="⬆ upload bar / entertainment operating license" doneLabel="✓ License uploaded — click to replace" style={{ marginBottom: 12 }} />
        <FileDropBox value={addressProof} onChange={setAddressProof} accept="image/*,.pdf" label="⬆ upload utility bill / lease / registration" doneLabel="✓ Address proof uploaded — click to replace" />
      </div>

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

      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <div style={{ display: 'flex', gap: 10, maxWidth: 640 }}>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
        <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!valid || submitting} onClick={submit}>
          {submitting ? 'Submitting…' : 'Submit for verification →'}
        </button>
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>🔒 reviewed manually by our team · usually approved within 24h</div>
    </div>
  );
}
