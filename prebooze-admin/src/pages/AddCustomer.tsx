import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { liveCustomers, LiveApiError } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Add customer';

/** Manual customer onboarding — for walk-ups, phone bookings and VIP guests
 * added by the team. Creates (or updates, if the phone already has an
 * account) a real User row via CustomersService.create. */
export default function AddCustomer() {
  const session = useLiveSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('—');
  const [city, setCity] = useState('');
  const [verified, setVerified] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Customer name is required');
      return;
    }
    if (!phone.trim()) {
      setErr('Phone number is required — it becomes their WhatsApp login');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const created = await liveCustomers.create({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        gender: gender === '—' ? undefined : gender,
        verified,
      });
      navigate(`/customers/${created.id}`);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add customer');
      setSaving(false);
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 520, gap: 12 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/customers" style={{ fontSize: 13 }}>← Customers</Link>
        <h1 className="page-title">Onboard new customer</h1>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        for walk-ups, phone bookings and VIP guests
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

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
      <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={verified} onChange={() => setVerified((v) => !v)} style={{ accentColor: 'var(--green)' }} />
        ID verified in person (skips Aadhaar upload — marks account Active ✓)
      </label>
      <div className="tiny hint">gender is used by gender-targeted promo codes at checkout · unverified customers can book but don't get the ✓ badge</div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }} disabled={saving}>
          {saving ? 'Saving…' : 'Onboard customer ✓'}
        </button>
        <Link to="/customers" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
