import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { auth, venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import ChangePhoneNumber from '../../components/ChangePhoneNumber';
import type { Venue } from '../../types';

/** Venue account settings — contact, notifications, payment method pointer,
 * identity verification. Real PATCH /me (the same generic profile endpoint
 * every role's contact fields ride on — no venue-specific backend needed
 * for that part). */
export default function VenueSettings() {
  const { user, updateUser, toast } = useApp();
  const [contact, setContact] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [venue, setVenue] = useState<Venue | null>(null);
  useEffect(() => {
    venuePartner.myListing().then(setVenue).catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const updated = await auth.updateMe({ name: contact.trim(), email: email.trim() });
      updateUser(updated);
      toast('Settings saved ✓');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Settings</h1>

      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
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
        <button className="btn btn-pri" disabled={saving}>{saving ? 'Saving…' : 'Save ✓'}</button>
      </form>

      <div style={{ marginBottom: 18 }}>
        <ChangePhoneNumber />
      </div>

      {venue && (
        <div className="evrow" style={{ flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">
              Verification
              {venue.verified && <span className="verified" style={{ marginLeft: 6 }}>✓</span>}
            </div>
            <div className="tiny muted">
              {venue.verified ? 'Your identity is verified' : "License + address proof — a one-time verified badge, doesn't affect your listing being live"}
            </div>
          </div>
          {!venue.verified && <Link to="/venue/settings/verification" className="btn btn-pri btn-sm">Complete verification →</Link>}
        </div>
      )}

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
