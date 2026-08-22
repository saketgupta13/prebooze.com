import { useState } from 'react';
import { liveCustomers, LiveApiError } from '../lib/liveApi';

/** Admin "god mode" login-number change for an organizer/venue's owning
 * User — the only self-serve path (ChangePhoneNumber.tsx) requires being
 * logged in already, which is exactly the wall a genuinely locked-out
 * account hits. No OTP round-trip, same trust level as every other field
 * on these edit forms. Lives on the Organizer/Venue edit pages (keyed by
 * their real userId), not the generic Customers list — that's where staff
 * actually go to fix a specific business account. */
export default function AdminChangePhone({ userId, currentPhone }: { userId: string; currentPhone?: string | null }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [savedPhone, setSavedPhone] = useState<string | null>(null);

  const save = async () => {
    if (!phone.trim()) return;
    setSaving(true);
    setErr('');
    try {
      const updated = await liveCustomers.updatePhone(userId, phone.trim());
      setSavedPhone(updated.phone);
      setOpen(false);
      setPhone('');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update number');
    } finally {
      setSaving(false);
    }
  };

  const shown = savedPhone ?? currentPhone;

  if (!open) {
    return (
      <div className="field">
        <label>Login number</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tiny muted">{shown || '—'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(true); setPhone(''); setErr(''); }}>
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="tiny hint">
        No OTP round-trip — this directly changes what number they log in with, same trust level as any other field here. Use it when the account is genuinely locked out of its old number (a self-serve change happens from their own Settings once they can log in).
      </div>
      <div className="field">
        <label>New login number</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" inputMode="tel" autoFocus />
      </div>
      {err && <div className="tiny" style={{ color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-pri btn-sm" disabled={saving || !phone.trim()} onClick={save}>
          {saving ? 'Saving…' : 'Save new number'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
