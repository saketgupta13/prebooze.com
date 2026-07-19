import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import LocationPicker, { emptyLocation } from '../../components/LocationPicker';
import RoleTaken from '../../components/RoleTaken';
import { existingRole } from '../../lib/roles';

export default function Onboarding() {
  const { user, updateUser } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — business profile
  const [logo, setLogo] = useState(false);
  const [brand, setBrand] = useState(user?.orgBrand ?? '');
  const [username, setUsername] = useState(user?.orgUsername ?? '');
  const [contact, setContact] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [altPhone, setAltPhone] = useState('');
  const [loc, setLoc] = useState(emptyLocation);
  const [types, setTypes] = useState('Concerts');
  const [about, setAbout] = useState('');
  const [links, setLinks] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  // Step 2 — KYC + bank
  const [aadhaar, setAadhaar] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');

  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'organizer') return <RoleTaken has={otherRole} />;

  const step1Valid = brand.trim() && username.trim() && pan.trim();
  const step2Valid = aadhaar && selfie && account.trim() && ifsc.trim();
  const pct = step === 1 ? 50 : 90;

  const submit = () => {
    updateUser({ isOrganizer: true, orgBrand: brand.trim(), orgUsername: username.trim() });
    navigate('/organizer');
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
                <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" />
              </div>
              <div className="field">
                <span>Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@brand" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <span>Contact person name</span>
                <input value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
              <div className="field">
                <span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <span>Alternate phone number</span>
                <input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
              </div>
              <div className="field">
                <span>WhatsApp</span>
                <input value={user?.phone ?? ''} disabled />
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

            <button className="btn btn-pri btn-block btn-lg" disabled={!step1Valid}>
              Save & continue → KYC
            </button>
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
                {aadhaar ? '✓ Aadhaar uploaded · verified with UIDAI' : '⬆ upload Aadhaar front'}
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
                  ✓ penny-drop verification passed
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
              🔒 reviewed by admin · usually approved within 24h (instant in this demo)
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
