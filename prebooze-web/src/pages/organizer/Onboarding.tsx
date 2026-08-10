import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const EVENT_TYPES = ['Concerts', 'Comedy', 'Festivals', 'Club nights', 'Corporate', 'Weddings & private', 'Mixed'];

const DRAFT_ID = 'organizer';
// Deliberately excludes logo/aadhaar/selfie — those are full-size photo data
// URLs, and persisting a couple of MB-sized images into localStorage risks
// hitting the per-origin quota (~5-10MB total). When that write throws, it
// used to take the whole draft down with it, which is what made switching
// steps look like it "forgot" the uploads. Photos now just live in React
// state — fine across step 1 <-> step 2 within the same visit, and
// re-uploading after a fresh page load is the right expectation for ID docs.
type Draft = {
  brand: string; username: string; loc: LocationValue; types: string[]; about: string;
  instagram: string; facebook: string; other: string[]; gstin: string; noGst: boolean; pan: string;
  bankName: string; account: string; accountHolder: string; ifsc: string;
};
const emptyDraft: Draft = {
  brand: '', username: '', loc: emptyLocation(), types: [], about: '',
  instagram: '', facebook: '', other: [''], gstin: '', noGst: false, pan: '',
  bankName: '', account: '', accountHolder: '', ifsc: '',
};

export default function Onboarding() {
  const { user, submitRoleApplication, updateUser } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [logo, setLogo] = useState('');
  const [brand, setBrand] = useState(user?.orgBrand || draft0.brand);
  const [username, setUsername] = useState(user?.orgUsername || draft0.username);
  const [loc, setLoc] = useState(draft0.loc);
  const [types, setTypes] = useState<string[]>(draft0.types);
  const [about, setAbout] = useState(draft0.about);
  const [instagram, setInstagram] = useState(draft0.instagram);
  const [facebook, setFacebook] = useState(draft0.facebook);
  const [other, setOther] = useState<string[]>(draft0.other.length ? draft0.other : ['']);
  const [gstin, setGstin] = useState(draft0.gstin);
  const [noGst, setNoGst] = useState(draft0.noGst);
  const [pan, setPan] = useState(draft0.pan);

  // Step 2 — KYC + bank
  const [aadhaar, setAadhaar] = useState('');
  const [selfie, setSelfie] = useState('');
  const [bankName, setBankName] = useState(draft0.bankName);
  const [account, setAccount] = useState(draft0.account);
  const [accountHolder, setAccountHolder] = useState(draft0.accountHolder);
  const [ifsc, setIfsc] = useState(draft0.ifsc);

  useEffect(() => {
    try {
      saveDraft(DRAFT_ID, { brand, username, loc, types, about, instagram, facebook, other, gstin, noGst, pan, bankName, account, accountHolder, ifsc });
    } catch {
      // best-effort — a full localStorage quota shouldn't block onboarding itself
    }
  }, [brand, username, loc, types, about, instagram, facebook, other, gstin, noGst, pan, bankName, account, accountHolder, ifsc]);

  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'organizer') return <RoleTaken has={otherRole} />;

  const step1Valid = brand.trim() && username.trim() && pan.trim() && (noGst || gstin.trim()) && types.length > 0;
  const step2Valid = aadhaar && selfie && bankName.trim() && account.trim() && accountHolder.trim() && ifsc.trim();
  const pct = step === 1 ? 50 : 90;

  const toggleType = (t: string) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const setOtherLink = (i: number, v: string) => setOther((prev) => prev.map((l, idx) => (idx === i ? v : l)));
  const addOtherLink = () => setOther((prev) => [...prev, '']);
  const removeOtherLink = (i: number) => setOther((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']));

  const submit = async () => {
    const otherLinks = other.map((l) => l.trim()).filter(Boolean);
    if (!isBackendEnabled()) {
      submitRoleApplication('organizer', { orgBrand: brand.trim(), orgUsername: username.trim() });
      clearDraft(DRAFT_ID);
      navigate('/organizer'); // console redirects to a "pending review" screen until the team approves
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const [aadhaarFile, selfieFile] = await Promise.all([
        dataUrlToFile(aadhaar, 'aadhaar.jpg'),
        dataUrlToFile(selfie, 'selfie.jpg'),
      ]);
      const payload = {
        brand: brand.trim(), brandName: brand.trim(), username: username.trim(),
        city: loc.city, country: loc.country, state: loc.state, pincode: loc.pincode, types, about,
        socialLinks: { instagram: instagram.trim() || undefined, facebook: facebook.trim() || undefined, other: otherLinks },
        gstin: noGst ? '' : gstin.trim().toUpperCase(), pan: pan.trim().toUpperCase(),
        bankName: bankName.trim(), bankAccount: account.trim(), accountHolderName: accountHolder.trim(), bankIfsc: ifsc.trim(),
      };
      const res = await kyc.submitRole('organizer', payload, [aadhaarFile, selfieFile]);
      updateUser({ ...res.user, pendingRole: 'organizer' });
      pushEvent('organizer_onboarding_submitted');
      trackMeta('Lead', { content_name: 'organizer_onboarding' });
      clearDraft(DRAFT_ID);
      navigate('/organizer'); // console redirects to a "pending review" screen until the team approves
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
          <h1 style={{ fontSize: 24 }}>
            {step === 1 ? 'Set up your organizer profile' : 'Verify your business'}
          </h1>
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
              setStep(2);
            }}
          >
            <FileDropBox
              value={logo}
              onChange={setLogo}
              label="logo + — Brand logo — shown on every event you publish"
              doneLabel="✓ Logo added — click to replace"
              style={{ marginBottom: 16 }}
            />

            <div className="form-row">
              <div className="field">
                <span>Organizer / brand name</span>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" autoFocus />
              </div>
              <div className="field">
                <span>Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@brand" />
              </div>
            </div>
            <LocationPicker value={loc} onChange={setLoc} />
            <div className="field">
              <span>Event types you host</span>
              <div className="chip-row">
                {EVENT_TYPES.map((t) => (
                  <button type="button" key={t} className={`chip ${types.includes(t) ? 'on' : ''}`} onClick={() => toggleType(t)}>
                    {t}{types.includes(t) ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>About your brand</span>
              <WysiwygEditor value={about} onChange={setAbout} minHeight={80} />
            </div>
            <div className="field">
              <span>Website & social links</span>
              <div className="form-row">
                <div className="field">
                  <span>Instagram</span>
                  <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram.com/yourbrand" />
                </div>
                <div className="field">
                  <span>Facebook</span>
                  <input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/yourbrand" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {other.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6 }}>
                    <input
                      style={{ flex: 1 }}
                      value={l}
                      onChange={(e) => setOtherLink(i, e.target.value)}
                      placeholder={i === 0 ? 'Website, X, YouTube…' : 'Another link'}
                    />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOtherLink(i)} title="Remove">✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addOtherLink}>+ Add another link</button>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <span>PAN number</span>
                <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} maxLength={10} />
              </div>
              <div className="field">
                <span>GSTIN</span>
                <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} disabled={noGst} maxLength={15} />
                <label className="checkbox-row" style={{ marginTop: 6 }}>
                  <input type="checkbox" checked={noGst} onChange={() => setNoGst((v) => !v)} />
                  I don't have a GSTIN
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                ← Back
              </button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!step1Valid}>
                Save & continue → KYC
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p className="muted small" style={{ marginBottom: 16 }}>
              Verified organizers get the <span className="verified">✓</span> badge and payouts
              enabled.
            </p>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 4 }}>1 · Government ID</h3>
              <p className="tiny muted" style={{ marginBottom: 12 }}>Aadhaar, PAN card, or any government photo ID</p>
              <FileDropBox
                value={aadhaar}
                onChange={setAadhaar}
                label="⬆ upload a clear photo of your ID"
                doneLabel="✓ ID uploaded — click to replace"
              />
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 4 }}>2 · Live selfie</h3>
              <p className="tiny muted" style={{ marginBottom: 12 }}>Used to match against your ID — good lighting, face clearly visible</p>
              <FileDropBox value={selfie} onChange={setSelfie} label="📷 capture or upload a selfie" doneLabel="✓ Selfie captured — click to replace" />
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>3 · Bank for payouts</h3>
              <div className="form-row">
                <div className="field">
                  <span>Bank name</span>
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" />
                </div>
                <div className="field">
                  <span>Account holder's name</span>
                  <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <span>Account number</span>
                  <input value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" />
                </div>
                <div className="field">
                  <span>IFSC code</span>
                  <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
              {bankName && account && accountHolder && ifsc && (
                <div className="small" style={{ color: '#4fd394' }}>
                  ✓ bank details captured — verified during manual review
                </div>
              )}
            </div>

            {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!step2Valid || submitting} onClick={submit}>
                {submitting ? 'Submitting…' : 'Submit — get the verified ✓ badge'}
              </button>
            </div>
            <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
              🔒 reviewed manually by our team · usually approved within 24h
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
