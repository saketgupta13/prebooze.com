import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { organizer } from '../../api';
import { ApiError } from '../../api/client';
import type { Organizer } from '../../types';

const EVENT_TYPES = ['Concerts', 'Comedy', 'Festivals', 'Club nights', 'Corporate', 'Weddings & private', 'Mixed'];

/** Real organizer self-serve settings — GET/PATCH /organizer/me. Every field
 * captured at onboarding (Onboarding.tsx) round-trips here pre-filled, since
 * GET /organizer/me returns the same row KycService.newOrganizerRow wrote at
 * approval time. Team members, notification prefs, refund-policy defaults
 * and self-deactivation had no real backend behind them at all (no Prisma
 * fields, no endpoints) — dropped rather than left as toggles that silently
 * do nothing. Team & roles stays reachable via its own nav item. */
export default function Settings() {
  const [org, setOrg] = useState<Organizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const [about, setAbout] = useState('');
  const [links, setLinks] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contact, setContact] = useState('');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [bankName, setBankName] = useState('');
  const [bank, setBank] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [ifsc, setIfsc] = useState('');

  useEffect(() => {
    organizer
      .me()
      .then((o) => {
        setOrg(o);
        setAbout(o.about ?? '');
        setLinks(o.links ?? '');
        setGstin(o.gstin ?? '');
        setPan(o.pan ?? '');
        setContactPerson(o.contactPerson ?? '');
        setContact(o.contact ?? '');
        setEventTypes(o.eventTypes ? o.eventTypes.split(',').map((t) => t.trim()).filter(Boolean) : []);
        setBankName(o.bankName ?? '');
        setBank(o.bankAccountNumber ?? '');
        setAccountHolder(o.accountHolderName ?? '');
        setIfsc(o.ifsc ?? '');
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const toggleOpen = (key: string) => setOpen((o) => (o === key ? null : key));
  const toggleType = (t: string) => setEventTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const saveProfile = async () => {
    setErr('');
    setSaving(true);
    try {
      const updated = await organizer.updateMe({ about, links, gstin, pan, contactPerson, contact, eventTypes: eventTypes.join(', ') });
      setOrg(updated);
      setOpen(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveBank = async () => {
    if (!bankName.trim() || !bank.trim() || !accountHolder.trim() || !ifsc.trim()) return;
    setErr('');
    setSaving(true);
    try {
      const updated = await organizer.updateMe({ bankName, bankAccount: bank, accountHolderName: accountHolder, ifsc });
      setOrg(updated);
      setOpen(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="muted">Loading…</div>;
  if (!org) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Settings</h1>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <div className="card">
        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Brand profile</div>
            <div className="tiny muted">{org.brandName} · about, links, GSTIN, PAN — public page</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleOpen('profile')}>
            {open === 'profile' ? 'Close' : 'Manage'}
          </button>
          {open === 'profile' && (
            <div style={{ flexBasis: '100%', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-row">
                <div className="field">
                  <span>Contact person</span>
                  <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                </div>
                <div className="field">
                  <span>Business email</span>
                  <input value={contact} onChange={(e) => setContact(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <span>About the brand</span>
                <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} />
              </div>
              <div className="field">
                <span>Website & social links</span>
                <input value={links} onChange={(e) => setLinks(e.target.value)} placeholder="site · ig · X" />
              </div>
              <div className="field">
                <span>Event types you host</span>
                <div className="chip-row">
                  {EVENT_TYPES.map((t) => (
                    <button type="button" key={t} className={`chip ${eventTypes.includes(t) ? 'on' : ''}`} onClick={() => toggleType(t)}>
                      {t}{eventTypes.includes(t) ? ' ✓' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <span>PAN number</span>
                  <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
                </div>
                <div className="field">
                  <span>GSTIN</span>
                  <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
              <button className="btn btn-pri btn-sm" style={{ alignSelf: 'flex-start' }} disabled={saving} onClick={saveProfile}>
                {saving ? 'Saving…' : 'Save profile ✓'}
              </button>
            </div>
          )}
        </div>

        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Bank for payouts</div>
            <div className="tiny muted">
              {org.bankLast4 ? `${org.bankName ? org.bankName + ' · ' : ''}•••• ${org.bankLast4}` : 'no bank details on file'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleOpen('bank')}>
            {open === 'bank' ? 'Close' : 'Manage'}
          </button>
          {open === 'bank' && (
            <div style={{ flexBasis: '100%', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-row">
                <div className="field">
                  <span>Bank name</span>
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" />
                </div>
                <div className="field">
                  <span>Account holder's name</span>
                  <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <span>Account number</span>
                  <input value={bank} onChange={(e) => setBank(e.target.value)} inputMode="numeric" />
                </div>
                <div className="field">
                  <span>IFSC code</span>
                  <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
              <button className="btn btn-pri btn-sm" style={{ alignSelf: 'flex-start' }} disabled={!bankName.trim() || !bank.trim() || !accountHolder.trim() || !ifsc.trim() || saving} onClick={saveBank}>
                {saving ? 'Saving…' : 'Save bank details ✓'}
              </button>
            </div>
          )}
        </div>

        <div className="evrow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Team & roles</div>
            <div className="tiny muted">door-scan access, managers</div>
          </div>
          <Link to="/organizer/team" className="btn btn-ghost btn-sm">Manage →</Link>
        </div>
      </div>
    </div>
  );
}
