import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import RoleTaken from '../../components/RoleTaken';
import { existingRole } from '../../lib/roles';
import { loadDraft, saveDraft, clearDraft } from '../../lib/formDraft';
import WysiwygEditor from '../../components/WysiwygEditor';
import { FileDropBox } from '../../components/FileDropBox';
import { promoter, kyc } from '../../api';
import { isBackendEnabled, ApiError } from '../../api/client';
import { pushEvent } from '../../lib/gtm';
import { trackMeta } from '../../lib/meta';
import { useDraftLead } from '../../lib/useDraftLead';
import { Camera, CheckCircle2, X, ArrowLeft, ArrowRight } from 'lucide-react';

const DRAFT_ID = 'promoter';
type Draft = {
  brand: string; loc: LocationValue; bio: string; links: string;
  audience: string;
};
const emptyDraft: Draft = {
  brand: '', loc: emptyLocation(), bio: '', links: '', audience: '',
};

/** Promoter onboarding — self-serve, minimal, single-step, same pattern as
 * organizer's Onboarding.tsx: profile only, no admin review — a promoter
 * can start capturing guests the moment this is submitted. Username is
 * auto-derived from the brand name server-side (KycService.
 * quickSignupPromoter), not typed here. Identity verification (ID + selfie)
 * moved entirely to a separate, optional, self-serve step — see
 * PromoterVerification.tsx, reachable from promoter Settings whenever
 * ready, never blocking anything here. */
export default function PromoterOnboarding() {
  const { user, submitRoleApplication, updateUser } = useApp();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [logo, setLogo] = useState('');
  const [brand, setBrand] = useState(draft0.brand);
  const [loc, setLoc] = useState(draft0.loc);
  const [bio, setBio] = useState(draft0.bio);
  const [links, setLinks] = useState(draft0.links);
  const [audience, setAudience] = useState(draft0.audience);

  useEffect(() => {
    try {
      saveDraft(DRAFT_ID, { brand, loc, bio, links, audience });
    } catch {
      // best-effort — a full localStorage quota shouldn't block onboarding itself
    }
  }, [brand, loc, bio, links, audience]);

  useDraftLead('promoter', brand, { city: loc.city });

  if (!user) return <Navigate to="/login" state={{ from: '/promoter/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'promoter') return <RoleTaken has={otherRole} />;

  const valid = brand.trim() && loc.city.trim() && bio.trim();

  const submit = async () => {
    if (!isBackendEnabled()) {
      submitRoleApplication('promoter', { promoterBrand: brand.trim(), promoterPlan: 'free' });
      clearDraft(DRAFT_ID);
      navigate('/promoter');
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const res = await kyc.quickSignupPromoter({
        brand: brand.trim(),
        city: loc.city, country: loc.country, state: loc.state, pincode: loc.pincode,
        bio, links, audience: audience.trim() || undefined,
      });
      updateUser(res.user);
      // Logo is only a local preview (data URL) until now — promoter.upload
      // requires a real Promoter row to already exist (it checks
      // ownership), which only just happened above. Best-effort: a failed/
      // skipped logo shouldn't block account creation itself.
      if (logo) {
        try {
          const blob = await fetch(logo).then((r) => r.blob());
          const file = new File([blob], 'logo.jpg', { type: blob.type || 'image/jpeg' });
          const { url } = await promoter.upload(file);
          await promoter.updateMe({ logoUrl: url });
        } catch {
          // logo upload failed — account still created fine, just no logo yet
        }
      }
      pushEvent('promoter_onboarding_submitted');
      trackMeta('Lead', { content_name: 'promoter_onboarding' }, `${user?.phone}_promoter`);
      clearDraft(DRAFT_ID);
      navigate('/promoter'); // straight to the real dashboard — no pending-review wait
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to submit — try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 24 }}>Set up your promoter profile</h1>
        <p className="muted small" style={{ margin: '6px 0 18px' }}>
          Just enough to start sharing your link — add the rest later, whenever you're ready.
        </p>

        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) submit();
          }}
        >
          <FileDropBox
            value={logo}
            onChange={setLogo}
            label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Camera size={15} /> logo + — a mark guests recognise on your lists and links</span>}
            doneLabel={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={15} /> Logo / photo added — click to replace</span>}
            style={{ marginBottom: 16 }}
          />
          <div className="field">
            <span>Promoter / brand name</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Nova Nights" autoFocus />
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
          {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigate(-1)}>
              <ArrowLeft size={15} /> Back
            </button>
            <button className="btn btn-pri btn-lg" style={{ flex: 1, minWidth: 0, whiteSpace: 'normal', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={!valid || submitting}>
              {submitting ? 'Setting up…' : <>Create my promoter account <ArrowRight size={16} /></>}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
