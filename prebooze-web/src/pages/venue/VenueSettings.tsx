import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

/** Venue account settings — contact, notifications, payment method pointer. */
export default function VenueSettings() {
  const { user, updateUser, toast } = useApp();
  const [contact, setContact] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ name: contact.trim(), email: email.trim() });
    toast('Settings saved ✓');
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Settings</h1>

      <form className="card" onSubmit={save} style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 12 }}>Contact</h3>
        <div className="form-row">
          <div className="field">
            <span>Contact person</span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Manager name" />
          </div>
          <div className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="venue@mail.com" />
          </div>
        </div>
        <div className="field">
          <span>WhatsApp number</span>
          <input value={user?.phone ?? ''} disabled />
        </div>
        <button className="btn btn-pri">Save ✓</button>
      </form>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Notifications</h3>
        <p className="muted small">
          Event confirmations at your venue, verification updates and partnership messages land on WhatsApp{' '}
          <b>{user?.phone}</b>{user?.email ? <> and {user.email}</> : null}.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Payments</h3>
        <p className="muted small" style={{ marginBottom: 10 }}>
          Venue hire is settled directly between you and the organizer today. Saved methods are used for optional
          paid placements.
        </p>
        <Link to="/payment-methods" className="btn btn-ghost btn-sm">Manage payment methods →</Link>
      </div>
    </div>
  );
}
