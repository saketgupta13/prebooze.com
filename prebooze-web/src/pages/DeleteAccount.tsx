import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { auth } from '../api';
import { ApiError } from '../api/client';

/** Public, no-app-required self-service account deletion — the URL Google's
 * Play Console Data Safety form requires (it won't accept an in-app-only
 * flow). Gated behind RequireAuth in App.tsx, same login (phone + OTP) every
 * other guest page already uses, so this is real self-service rather than a
 * "contact us" page. Same real backend contract (POST /me/delete) as the
 * guest/organizer RN apps' DeleteAccountScreen. */
export default function DeleteAccount() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!user) return null;

  const deleteNow = async () => {
    setBusy(true);
    setErr('');
    try {
      await auth.deleteAccount();
      logout();
      navigate('/', { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong — try again.');
      setBusy(false);
    }
  };

  return (
    <div className="page-narrow" style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ marginBottom: 8 }}>Delete your account</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Signed in as <strong>{user.name}</strong> ({user.phone})
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <p>
          This permanently closes your Prebooze login and removes your personal info. Your booking history is
          kept for receipts, but you won't be able to sign in again. This can't be undone.
        </p>
      </div>

      {err && (
        <div className="card" style={{ borderColor: 'var(--red, #e5484d)', color: 'var(--red, #e5484d)', marginBottom: 16 }}>
          {err}
        </div>
      )}

      {!confirming ? (
        <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
          <AlertTriangle size={15} style={{ marginRight: 6 }} />
          Delete my account
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={deleteNow} disabled={busy}>
            {busy ? 'Deleting…' : 'Yes, permanently delete my account'}
          </button>
        </div>
      )}
    </div>
  );
}
