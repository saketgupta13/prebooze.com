import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';

export default function AddOrganizer() {
  const { addOrganizer, organizers, toast } = useAdmin();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [commission, setCommission] = useState('');
  const [docs, setDocs] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Enter an organizer name');
      return;
    }
    addOrganizer({
      id: 'o' + (organizers.length + 1 + Date.now() % 1000),
      name: name.trim(),
      contact: contact.trim() || '—',
      city: city.trim() || '—',
      events: 0,
      kyc: docs ? 'submitted' : 'pending',
      status: 'pending',
    });
    navigate('/organizers');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 520 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/organizers" style={{ fontSize: 13 }}>← Organizers</Link>
        <h1 className="page-title">Add new organizer</h1>
      </div>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Organizer / company name" autoFocus />
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact email" />
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
      </div>
      <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
      <input
        className="input"
        value={commission}
        onChange={(e) => setCommission(e.target.value)}
        placeholder="Commission rate % (per event, set later)"
      />
      <button
        type="button"
        className="dashed-box"
        style={{ background: 'none', textAlign: 'left', color: docs ? 'var(--green)' : 'var(--muted)', fontSize: 11.5, cursor: 'pointer' }}
        onClick={() => setDocs((d) => !d)}
      >
        {docs
          ? '✓ KYC docs attached (PAN / GST / business proof)'
          : '+ upload KYC docs (PAN / GST / business proof) — organizer stays "Pending review" until approved'}
      </button>
      <button type="submit" className="btn btn-pri" style={{ padding: 10, fontSize: 13 }}>Send invite</button>
      <div className="tiny hint">invite sends a portal link for the organizer to set their password</div>
    </form>
  );
}
