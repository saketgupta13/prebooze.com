import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';

/** Add organizer — same full onboarding steps as the organizer-facing flow:
 * 1 · business profile → 2 · KYC & bank → review & invite. */
export default function AddOrganizer() {
  const { addOrganizer, toast } = useAdmin();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — business profile
  const [logo, setLogo] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [eventTypes, setEventTypes] = useState('Concerts');
  const [about, setAbout] = useState('');
  const [links, setLinks] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  // Step 2 — KYC & bank
  const [aadhaar, setAadhaar] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [kycDocs, setKycDocs] = useState(false);
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [commission, setCommission] = useState('');

  const step1Valid = name.trim() && contact.trim() && pan.trim();
  const pct = step === 1 ? 50 : 90;

  const submit = () => {
    addOrganizer({
      id: 'o' + Date.now(),
      name: name.trim(),
      contact: contact.trim(),
      city: city.trim() || '—',
      events: 0,
      kyc: aadhaar && selfie && kycDocs ? 'submitted' : 'pending',
      status: 'pending',
      contactPerson: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      eventTypes,
      about: about.trim() || undefined,
      links: links.trim() || undefined,
      gstin: gstin.trim() || undefined,
      pan: pan.trim() || undefined,
      bankLast4: account ? account.slice(-4) : undefined,
    });
    navigate('/organizers');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 560, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/organizers" style={{ fontSize: 13 }}>← Organizers</Link>
        <h1 className="page-title">{step === 1 ? 'Add organizer — business profile' : 'Add organizer — KYC & bank'}</h1>
        <div style={{ flex: 1 }} />
        <span className="small muted" style={{ fontWeight: 700 }}>step {step} of 2</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 7, borderRadius: 999, background: 'var(--input)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--green)', transition: 'width .2s' }} />
        </div>
        <span className="small muted" style={{ fontWeight: 700 }}>{pct}%</span>
      </div>

      {step === 1 ? (
        <form
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!step1Valid) {
              toast('Brand name, contact email and PAN are required');
              return;
            }
            setStep(2);
          }}
        >
          <button
            type="button"
            className="dashed-box"
            style={{ background: 'none', textAlign: 'left', cursor: 'pointer', color: logo ? 'var(--green)' : 'var(--muted)', fontSize: 11.5 }}
            onClick={() => setLogo((v) => !v)}
          >
            {logo ? '✓ Brand logo uploaded — shown on every event they publish' : '+ upload brand logo — shown on every event they publish'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Organizer / brand name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Contact person</label>
              <input className="input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Contact email</label>
              <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Phone / WhatsApp</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>City</label>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Event types hosted</label>
              <select className="input" value={eventTypes} onChange={(e) => setEventTypes(e.target.value)}>
                <option>Concerts</option>
                <option>Comedy</option>
                <option>Festivals</option>
                <option>Club nights</option>
                <option>Mixed</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>About the brand</label>
            <textarea className="input" style={{ minHeight: 56, resize: 'vertical' }} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What do they host?" />
          </div>
          <div className="field">
            <label>Website & social links</label>
            <input className="input" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="site / ig / X" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>GSTIN (optional)</label>
              <input className="input" value={gstin} onChange={(e) => setGstin(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>PAN number</label>
              <input className="input" value={pan} onChange={(e) => setPan(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-pri" style={{ padding: 10 }}>Save & continue → KYC</button>
        </form>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="display" style={{ fontWeight: 700 }}>1 · Identity (Aadhaar + selfie)</div>
            <button
              type="button"
              className="dashed-box"
              style={{ background: 'none', textAlign: 'left', cursor: 'pointer', color: aadhaar ? 'var(--green)' : 'var(--muted)', fontSize: 11.5 }}
              onClick={() => setAadhaar((v) => !v)}
            >
              {aadhaar ? '✓ Aadhaar uploaded · verified with UIDAI' : '+ upload Aadhaar front'}
            </button>
            <button
              type="button"
              className="dashed-box"
              style={{ background: 'none', textAlign: 'left', cursor: 'pointer', color: selfie ? 'var(--green)' : 'var(--muted)', fontSize: 11.5 }}
              onClick={() => setSelfie((v) => !v)}
            >
              {selfie ? '✓ Selfie captured — matched with Aadhaar photo' : '📷 capture selfie — matched against Aadhaar photo'}
            </button>
            <button
              type="button"
              className="dashed-box"
              style={{ background: 'none', textAlign: 'left', cursor: 'pointer', color: kycDocs ? 'var(--green)' : 'var(--muted)', fontSize: 11.5 }}
              onClick={() => setKycDocs((v) => !v)}
            >
              {kycDocs ? '✓ Business docs attached (PAN / GST / proof)' : '+ upload business docs (PAN / GST / business proof)'}
            </button>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="display" style={{ fontWeight: 700 }}>2 · Bank for payouts</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Account number</label>
                <input className="input" value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>IFSC code</label>
                <input className="input" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
              </div>
            </div>
            {account && ifsc && <div className="small green">✓ penny-drop verification passed</div>}
            <div className="field">
              <label>Commission note (rate is set per event later)</label>
              <input className="input" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="e.g. 7% volume deal till Dec" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-pri" style={{ flex: 1, padding: 10 }} onClick={submit}>
              Send invite — lands as Pending review
            </button>
          </div>
          <div className="tiny hint">invite sends a portal link for the organizer to set their password · admin review unlocks event creation</div>
        </div>
      )}
    </div>
  );
}
