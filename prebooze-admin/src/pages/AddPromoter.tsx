import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';

/** Add promoter — admin onboards a PR directly: profile + plan + KYC toggles.
 * Lands as Pending review until approved. */
export default function AddPromoter() {
  const { addPromoter, subTiers, toast } = useAdmin();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [city, setCity] = useState('');
  const [plan, setPlan] = useState('free');
  const [bio, setBio] = useState('');
  const [aadhaar, setAadhaar] = useState(false);
  const [docs, setDocs] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) {
      toast('Promoter name and contact are required');
      return;
    }
    addPromoter({
      id: 'pr' + Date.now(),
      name: name.trim(),
      contact: contact.trim(),
      city: city.trim() || '—',
      status: 'pending',
      kyc: aadhaar && docs ? 'submitted' : 'pending',
      plan,
      guestsThisMonth: 0,
      eventsPromoted: 0,
      showRate: 0,
      bio: bio.trim() || undefined,
      guestsBrought: 0,
      perHeadEarned: 0,
      commissionEarned: 0,
      withdrawn: 0,
      payouts: [],
    });
    navigate('/promoters');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 560, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/promoters" style={{ fontSize: 13 }}>← Promoters</Link>
        <h1 className="page-title">Add promoter</h1>
      </div>

      <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={submit}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Promoter / PR name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Nova Nights" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Contact email / phone</label>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="hey@brand.co" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>City</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Subscription plan</label>
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
              {subTiers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea className="input" style={{ minHeight: 56, resize: 'vertical' }} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What kind of nights do they run?" />
        </div>

        <div className="dashed-box" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5 }}>
          <button type="button" style={{ background: 'none', textAlign: 'left', cursor: 'pointer', color: aadhaar ? 'var(--green)' : 'var(--muted)' }} onClick={() => setAadhaar((v) => !v)}>
            {aadhaar ? '✓ Aadhaar uploaded · verified with UIDAI' : '+ upload Aadhaar (identity KYC)'}
          </button>
          <button type="button" style={{ background: 'none', textAlign: 'left', cursor: 'pointer', color: docs ? 'var(--green)' : 'var(--muted)' }} onClick={() => setDocs((v) => !v)}>
            {docs ? '✓ Bank / payout details attached' : '+ attach bank details for payouts'}
          </button>
        </div>

        <button type="submit" className="btn btn-pri" style={{ padding: 10 }}>Add promoter — lands as Pending review</button>
        <div className="tiny hint">approving unlocks promoting · organizers still choose which promoters to allow per event</div>
      </form>
    </div>
  );
}
