import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import RoleTaken from '../../components/RoleTaken';
import { existingRole } from '../../lib/roles';
import { loadDraft, saveDraft, clearDraft } from '../../lib/formDraft';
import WysiwygEditor from '../../components/WysiwygEditor';
import { FileDropBox } from '../../components/FileDropBox';
import { dataUrlToFile } from '../../lib/fileUtils';
import { kyc } from '../../api';
import { isBackendEnabled, ApiError } from '../../api/client';
import { pushEvent } from '../../lib/gtm';
import { trackMeta } from '../../lib/meta';
import { attributionForPayload } from '../../lib/track';

const DRAFT_ID = 'promoter';
type Draft = {
  logo: string; brand: string; username: string; loc: LocationValue; bio: string; links: string;
  audience: string;
};
const emptyDraft: Draft = {
  logo: '', brand: '', username: '', loc: emptyLocation(), bio: '', links: '', audience: '',
};

/** Promoter onboarding — same 2-step pattern as organizer/venue/lineup: PR
 * profile → identity KYC → real POST /kyc/role (kind: 'promoter'), which
 * stays pending until an admin approves it (KycService.approve provisions
 * the real Promoter row, see kyc.service.ts's newPromoterRow). Deliberately
 * excludes idDoc/selfie from the localStorage draft — same reasoning as
 * organizer's Onboarding.tsx (multi-MB data URLs risk the storage quota). */
export default function PromoterOnboarding() {
  const { user, submitRoleApplication, updateUser } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [logo, setLogo] = useState(draft0.logo);
  const [brand, setBrand] = useState(draft0.brand);
  const [username, setUsername] = useState(draft0.username);
  const [loc, setLoc] = useState(draft0.loc);
  const [bio, setBio] = useState(draft0.bio);
  const [links, setLinks] = useState(draft0.links);
  const [audience, setAudience] = useState(draft0.audience);

  const [idDoc, setIdDoc] = useState('');
  const [selfie, setSelfie] = useState('');

  useEffect(() => {
    try {
      saveDraft(DRAFT_ID, { logo, brand, username, loc, bio, links, audience });
    } catch {
      // best-effort — a full localStorage quota shouldn't block onboarding itself
    }
  }, [logo, brand, username, loc, bio, links, audience]);

  if (!user) return <Navigate to="/login" state={{ from: '/promoter/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'promoter') return <RoleTaken has={otherRole} />;

  const step1Valid = brand.trim() && username.trim() && bio.trim();
  const step2Valid = idDoc && selfie;
  const pct = step === 1 ? 50 : 90;

  const submit = async () => {
    if (!isBackendEnabled()) {
      submitRoleApplication('promoter', { promoterBrand: brand.trim(), promoterUsername: username.trim(), promoterPlan: 'free' });
      clearDraft(DRAFT_ID);
      navigate('/promoter');
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const [idDocFile, selfieFile] = await Promise.all([
        dataUrlToFile(idDoc, 'id.jpg'),
        dataUrlToFile(selfie, 'selfie.jpg'),
      ]);
      const payload = {
        brand: brand.trim(), brandName: brand.trim(), username: username.trim(),
        city: loc.city, country: loc.country, state: loc.state, pincode: loc.pincode,
        bio, links, audience: audience.trim() || undefined,
        ...attributionForPayload(),
      };
      const res = await kyc.submitRole('promoter', payload, [idDocFile, selfieFile]);
      updateUser({ ...res.user, pendingRole: 'promoter' });
      pushEvent('promoter_onboarding_submitted');
      // eventId must match kyc.service.ts's submitRole server-side call.
      trackMeta('Lead', { content_name: 'promoter_onboarding' }, `${user?.phone}_promoter`);
      clearDraft(DRAFT_ID);
      navigate('/promoter'); // console redirects to a "pending review" screen until the team approves
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to submit — try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: 24 }}>{step === 1 ? 'Set up your promoter profile' : 'Verify your identity'}</h1>
          <span className="muted small bold">step {step} of 2</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 22px' }}>
          <div className="progress" style={{ flex: 1 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <span className="small muted bold">{pct}%</span>
        </div>

        {step === 1 ? (
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              if (step1Valid) setStep(2);
            }}
          >
            <FileDropBox
              value={logo}
              onChange={setLogo}
              label="📷 logo + — a mark guests recognise on your lists and links"
              doneLabel="✓ Logo / photo added — click to replace"
              style={{ marginBottom: 16 }}
            />
            <div className="form-row">
              <div className="field">
                <span>Promoter / brand name</span>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Nova Nights" autoFocus />
              </div>
              <div className="field">
                <span>Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@novanights" />
              </div>
            </div>
            <LocationPicker value={loc} onChange={setLoc} />
            <div className="field">
              <span>Links (socials / WhatsApp)</span>
              <input value={links} onChange={(e) => setLinks(e.target.value)} placeholder="ig / wa / telegram" />
            </div>
            <div className="field">
              <span>Bio — what nights do you run?</span>
              <WysiwygEditor value={bio} onChange={setBio} minHeight={80} />
            </div>
            <div className="field">
              <span>Audience size / reach (optional)</span>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. 8k on Instagram, 2k WhatsApp broadcast" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                ← Back
              </button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!step1Valid}>
                Save & continue → verification
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p className="muted small" style={{ marginBottom: 16 }}>
              Verified promoters get the <span className="verified">✓</span> badge and organizers approve them
              faster. KYC keeps fake guest lists off the platform.
            </p>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>1 · Government ID</h3>
              <FileDropBox value={idDoc} onChange={setIdDoc} label="⬆ upload Aadhaar / passport front" doneLabel="✓ ID uploaded — click to replace" />
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>2 · Selfie match</h3>
              <FileDropBox
                value={selfie}
                onChange={setSelfie}
                label="🤳 camera frame — face in oval · 📷 Capture selfie"
                doneLabel="✓ Selfie captured — click to replace"
                style={{ padding: selfie ? undefined : 30 }}
              />
            </div>
            {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!step2Valid || submitting} onClick={submit}>
                {submitting ? 'Submitting…' : 'Submit for review 📣'}
              </button>
            </div>
            <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
              🔒 encrypted · reviewed by admin · usually approved within 24h
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
