import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';

/** Manual customer onboarding — for walk-ups, phone bookings and VIP guests added by the team. */
export default function AddCustomer() {
  const { addCustomer, toast } = useAdmin();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('—');
  const [city, setCity] = useState('Austin');
  const [verified, setVerified] = useState(false);
  const [notes, setNotes] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Customer name is required');
      return;
    }
    if (!phone.trim()) {
      toast('Phone number is required — it becomes their WhatsApp login');
      return;
    }
    addCustomer({
      id: 'c' + Date.now(),
      name: name.trim(),
      verified,
      gender,
      city: city.trim() || '—',
      bookings: 0,
      spend: 0,
      status: verified ? 'active' : 'unverified',
      segment: 'guests',
      phone: phone.trim(),
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    navigate('/customers');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 520, gap: 12 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/customers" style={{ fontSize: 13 }}>← Customers</Link>
        <h1 className="page-title">Onboard new customer</h1>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        for walk-ups, phone bookings and VIP guests — the customer gets a WhatsApp OTP invite to claim the account
      </div>

      <div className="field">
        <label>Full name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>WhatsApp number (becomes their login)</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" inputMode="tel" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Email (optional)</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="guest@mail.com" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Gender</label>
          <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="—">Prefer not to say</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="O">Other</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>City</label>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Internal notes (optional)</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. VIP — comp'd entry at NYE Countdown" />
      </div>
      <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={verified} onChange={() => setVerified((v) => !v)} style={{ accentColor: 'var(--green)' }} />
        ID verified in person (skips Aadhaar upload — marks account Active ✓)
      </label>
      <div className="tiny hint">gender is used by gender-targeted promo codes at checkout · unverified customers can book but don't get the ✓ badge</div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>Onboard customer ✓</button>
        <Link to="/customers" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
