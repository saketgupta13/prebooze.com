import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { auth } from '../api';
import { ApiError } from '../api/client';

/** Self-serve login-number change — real OTP verification against the new
 * number (POST /me/phone/request-change + /confirm-change), shared by every
 * role's settings page since the login identity (User.phone) is the same
 * row for guest/organizer/promoter/venue/lineup. Replaces the old "contact
 * support to change" dead end. */
export default function ChangePhoneNumber() {
  const { user, updateUser, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [requestId, setRequestId] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const reset = () => {
    setOpen(false);
    setStep('phone');
    setNewPhone('');
    setCode('');
    setErr('');
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) return;
    setErr('');
    setBusy(true);
    try {
      const res = await auth.requestPhoneChange(newPhone.trim());
      setRequestId(res.requestId);
      setDevCode(res.devCode ?? '');
      setStep('otp');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to send code');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setErr('');
    setBusy(true);
    try {
      const updated = await auth.confirmPhoneChange(requestId, code.trim());
      updateUser({ phone: updated.phone });
      toast('Login number updated ✓');
      reset();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to verify code');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  if (!open) {
    return (
      <div className="card" style={{ background: 'var(--surface-2)', padding: 14, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span><span className="muted">Login number</span> <span className="bold">{user.phone}</span> <span className="verified">✓</span></span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Change number</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      {step === 'phone' ? (
        <form onSubmit={sendCode}>
          <div className="field">
            <span>New mobile number</span>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="10-digit number" inputMode="tel" autoFocus />
          </div>
          {err && <div className="tiny danger-text" style={{ marginBottom: 8 }}>✕ {err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-pri btn-sm" disabled={busy || !newPhone.trim()}>{busy ? 'Sending…' : 'Send code'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirm}>
          <p className="tiny muted" style={{ marginBottom: 8 }}>Enter the code sent to {newPhone} via WhatsApp{devCode ? ` (dev: ${devCode})` : ''}.</p>
          <div className="field">
            <span>Verification code</span>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoFocus />
          </div>
          {err && <div className="tiny danger-text" style={{ marginBottom: 8 }}>✕ {err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-pri btn-sm" disabled={busy || !code.trim()}>{busy ? 'Verifying…' : 'Confirm change'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
