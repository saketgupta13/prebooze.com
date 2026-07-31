import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { auth } from '../../api';
import { ApiError } from '../../api/client';

/** First-touch guest step, right after signup — deliberately minimal. This
 * used to require 13 fields (photo, username, full location, profession,
 * languages, bio, a social link, an interest) before a brand-new guest could
 * even get back to whatever they were doing, including finishing a purchase
 * they were mid-checkout on — directly undercutting the "book in 20 seconds"
 * promise on the homepage. Only name and DOB are genuinely needed to book a
 * ticket (name for the ticket itself, DOB for age-gated events); email is a
 * low-friction nice-to-have, not a hard requirement. Everything else moved
 * to FinishProfile.tsx, a soft-required nudge shown after a guest's first
 * booking instead of before it — see Confirmation.tsx. */
export default function ProfileCompletion() {
  const { updateUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!name.trim()) return setErr('Full name is required');
    if (!dob) return setErr('Date of birth is required');
    if (!gender) return setErr('Gender is required');
    if (email.trim() && !EMAIL_RE.test(email.trim())) return setErr('That email address doesn\'t look right');

    setSaving(true);
    try {
      const updated = await auth.updateMe({ name: name.trim(), dob, gender, email: email.trim() || undefined });
      updateUser(updated);
      navigate(from ?? '/');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 24 }}>Just a couple of things</h1>
        <p className="muted small" style={{ marginTop: 4 }}>
          We need your name and date of birth to issue tickets — everything else can wait.
        </p>

        {err && <div className="danger-text small" style={{ margin: '10px 0' }}>✕ {err}</div>}

        <form className="card" onSubmit={save} style={{ marginTop: 16 }}>
          <div className="field">
            <span>Full name *</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
          </div>
          <div className="form-row">
            <div className="field">
              <span>Date of birth *</span>
              <input required type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="field">
              <span>Gender *</span>
              <select required value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Select…</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="field">
            <span>Email (optional)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com — for receipts" />
          </div>

          <button className="btn btn-pri btn-block btn-lg" style={{ marginTop: 8 }} disabled={saving}>
            {saving ? 'Saving…' : 'Continue →'}
          </button>
        </form>
      </div>
    </main>
  );
}
