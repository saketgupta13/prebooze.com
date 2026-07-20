import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import RoleTaken from '../../components/RoleTaken';
import { existingRole } from '../../lib/roles';
import { loadDraft, saveDraft, clearDraft } from '../../lib/formDraft';

const DRAFT_ID = 'organizer';
type Draft = {
  logo: boolean; brand: string; username: string; loc: LocationValue; types: string; about: string;
  links: string; gstin: string; pan: string; aadhaar: boolean; selfie: boolean; account: string; ifsc: string;
};
const emptyDraft: Draft = {
  logo: false, brand: '', username: '', loc: emptyLocation(), types: 'Concerts', about: '',
  links: '', gstin: '', pan: '', aadhaar: false, selfie: false, account: '', ifsc: '',
};

export default function Onboarding() {
  const { user, submitRoleApplication } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [logo, setLogo] = useState(draft0.logo);
  const [brand, setBrand] = useState(user?.orgBrand || draft0.brand);
  const [username, setUsername] = useState(user?.orgUsername || draft0.username);
  const [loc, setLoc] = useState(draft0.loc);
  const [types, setTypes] = useState(draft0.types);
  const [about, setAbout] = useState(draft0.about);
  const [links, setLinks] = useState(draft0.links);
  const [gstin, setGstin] = useState(draft0.gstin);
  const [pan, setPan] = useState(draft0.pan);

  // Step 2 — KYC + bank
  const [aadhaar, setAadhaar] = useState(draft0.aadhaar);
  const [selfie, setSelfie] = useState(draft0.selfie);
  const [account, setAccount] = useState(draft0.account);
  const [ifsc, setIfsc] = useState(draft0.ifsc);

  useEffect(() => {
    saveDraft(DRAFT_ID, { logo, brand, username, loc, types, about, links, gstin, pan, aadhaar, selfie, account, ifsc });
  }, [logo, brand, username, loc, types, about, links, gstin, pan, aadhaar, selfie, account, ifsc]);

  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'organizer') return <RoleTaken has={otherRole} />;

  const step1Valid = brand.trim() && username.trim() && pan.trim();
  const step2Valid = aadhaar && selfie && account.trim() && ifsc.trim();
  const pct = step === 1 ? 50 : 90;

  const submit = () => {
    submitRoleApplication('organizer', { orgBrand: brand.trim(), orgUsername: username.trim() });
    clearDraft(DRAFT_ID);
    navigate('/organizer'); // console redirects to a "pending review" screen until the team approves
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
            <div
              className={`upload-box ${logo ? 'done' : ''}`}
              onClick={() => setLogo((v) => !v)}
              style={{ marginBottom: 16 }}
            >
              {logo ? '✓ Logo added' : 'logo + — Brand logo — shown on every event you publish'}
            </div>

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
              <select value={types} onChange={(e) => setTypes(e.target.value)}>
                <option>Concerts</option>
                <option>Comedy</option>
                <option>Festivals</option>
                <option>Club nights</option>
                <option>Mixed</option>
              </select>
            </div>
            <div className="field">
              <span>About your brand</span>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="About your brand — what do you host?"
              />
            </div>
            <div className="field">
              <span>Website & social links</span>
              <input value={links} onChange={(e) => setLinks(e.target.value)} placeholder="site / ig / X +" />
            </div>
            <div className="form-row">
              <div className="field">
                <span>GSTIN (optional)</span>
                <input value={gstin} onChange={(e) => setGstin(e.target.value)} />
              </div>
              <div className="field">
                <span>PAN number</span>
                <input value={pan} onChange={(e) => setPan(e.target.value)} />
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
              <h3 style={{ marginBottom: 12 }}>1 · Identity (Aadhaar + selfie)</h3>
              <div
                className={`upload-box ${aadhaar ? 'done' : ''}`}
                onClick={() => setAadhaar((v) => !v)}
                style={{ marginBottom: 10 }}
              >
                {aadhaar ? '✓ Aadhaar uploaded' : '⬆ upload Aadhaar front'}
              </div>
              <div className={`upload-box ${selfie ? 'done' : ''}`} onClick={() => setSelfie((v) => !v)}>
                {selfie ? '✓ Selfie captured' : '📷 Capture selfie'}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>2 · Bank for payouts</h3>
              <div className="form-row">
                <div className="field">
                  <span>Account number</span>
                  <input value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" />
                </div>
                <div className="field">
                  <span>IFSC code</span>
                  <input value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
                </div>
              </div>
              {account && ifsc && (
                <div className="small" style={{ color: '#4fd394' }}>
                  ✓ bank details captured — verified during manual review
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!step2Valid} onClick={submit}>
                Submit — get the verified ✓ badge
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
