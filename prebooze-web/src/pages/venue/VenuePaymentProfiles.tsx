import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import Loader from '../../components/Loader';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import type { VenuePaymentProfile } from '../../api';
import { AlertCircle, Check } from 'lucide-react';

type Draft = {
  legalName: string; businessAddress: string; loc: LocationValue;
  bankAccountNumber: string; accountHolderName: string; ifsc: string; branch: string;
  pan: string; gstin: string; noGst: boolean;
};
const emptyDraft: Draft = {
  legalName: '', businessAddress: '', loc: emptyLocation(),
  bankAccountNumber: '', accountHolderName: '', ifsc: '', branch: '',
  pan: '', gstin: '', noGst: false,
};

/** Venue-hosted equivalent of organizer/PaymentProfiles.tsx — bank accounts
 * this venue can withdraw its hosting revenue to, plural, self-serve, no
 * admin review, entirely separate from identity verification. withdraw()
 * always pays out to whichever profile is isDefault. */
export default function VenuePaymentProfiles() {
  const [profiles, setProfiles] = useState<VenuePaymentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const load = () =>
    venuePartner.paymentProfiles()
      .then(setProfiles)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const startNew = () => { setDraft(emptyDraft); setEditingId('new'); };
  const startEdit = (p: VenuePaymentProfile) => {
    setDraft({
      legalName: p.legalName, businessAddress: p.businessAddress,
      loc: { country: p.country ?? '', state: p.state ?? '', city: p.city ?? '', pincode: p.pincode ?? '' },
      bankAccountNumber: p.bankAccountNumber, accountHolderName: p.accountHolderName, ifsc: p.ifsc, branch: p.branch ?? '',
      pan: p.pan, gstin: p.gstin ?? '', noGst: p.noGst,
    });
    setEditingId(p.id);
  };

  const valid = draft.legalName.trim() && draft.businessAddress.trim() && draft.bankAccountNumber.trim()
    && draft.accountHolderName.trim() && draft.ifsc.trim() && draft.pan.trim() && (draft.noGst || draft.gstin.trim());

  const save = async () => {
    if (!valid) return;
    setErr('');
    setSaving(true);
    try {
      const data = {
        legalName: draft.legalName.trim(), businessAddress: draft.businessAddress.trim(),
        country: draft.loc.country.trim() || undefined, state: draft.loc.state.trim() || undefined,
        city: draft.loc.city.trim() || undefined, pincode: draft.loc.pincode.trim() || undefined,
        bankAccountNumber: draft.bankAccountNumber.trim(), accountHolderName: draft.accountHolderName.trim(),
        ifsc: draft.ifsc.trim().toUpperCase(), branch: draft.branch.trim() || undefined,
        pan: draft.pan.trim().toUpperCase(), gstin: draft.noGst ? undefined : draft.gstin.trim().toUpperCase(), noGst: draft.noGst,
      };
      if (editingId === 'new') await venuePartner.createPaymentProfile(data);
      else if (editingId) await venuePartner.updatePaymentProfile(editingId, data);
      setEditingId(null);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this payment profile?')) return;
    setErr('');
    try {
      await venuePartner.deletePaymentProfile(id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to remove');
    }
  };

  const makeDefault = async (id: string) => {
    setErr('');
    try {
      await venuePartner.setDefaultPaymentProfile(id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update');
    }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Payment profiles</h1>
        <Link to="/venue/hosting/settings" className="link small bold">← Back to Settings</Link>
      </div>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Bank accounts you can withdraw your hosting revenue to — hold more than one if you invoice under different entities. Withdrawals always pay out to whichever is set default. Doesn't require identity verification.
      </p>
      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={14} /> {err}</div>}

      {profiles.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: 12, maxWidth: 640 }}>
          {editingId === p.id ? (
            <ProfileForm draft={draft} setDraft={setDraft} valid={!!valid} saving={saving} onSave={save} onCancel={() => setEditingId(null)} />
          ) : (
            <div className="evrow" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bold small">
                  {p.legalName}
                  {p.isDefault && <span className="verified" style={{ marginLeft: 6 }}>default</span>}
                </div>
                <div className="tiny muted">•••• {p.bankLast4} · {p.accountHolderName} · {p.ifsc}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!p.isDefault && <button className="btn btn-ghost btn-sm" onClick={() => makeDefault(p.id)}>Set default</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(p.id)}>Remove</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {editingId === 'new' ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <ProfileForm draft={draft} setDraft={setDraft} valid={!!valid} saving={saving} onSave={save} onCancel={() => setEditingId(null)} />
        </div>
      ) : (
        <button className="btn btn-pri" onClick={startNew}>+ Add payment profile</button>
      )}
    </div>
  );
}

function ProfileForm({ draft, setDraft, valid, saving, onSave, onCancel }: {
  draft: Draft; setDraft: (d: Draft) => void; valid: boolean; saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="form-row">
        <div className="field">
          <span>Company / Firm / LLP / Individual name *</span>
          <input value={draft.legalName} onChange={(e) => set('legalName', e.target.value)} />
        </div>
        <div className="field">
          <span>Business address *</span>
          <input value={draft.businessAddress} onChange={(e) => set('businessAddress', e.target.value)} />
        </div>
      </div>
      <LocationPicker value={draft.loc} onChange={(loc) => set('loc', loc)} />
      <div className="form-row">
        <div className="field">
          <span>PAN *</span>
          <input value={draft.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} maxLength={10} />
        </div>
        <div className="field">
          <span>GSTIN *</span>
          <input value={draft.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} disabled={draft.noGst} maxLength={15} />
          <label className="checkbox-row" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={draft.noGst} onChange={() => set('noGst', !draft.noGst)} />
            I don't have a GSTIN
          </label>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <span>Bank name / Branch</span>
          <input value={draft.branch} onChange={(e) => set('branch', e.target.value)} placeholder="e.g. HDFC Bank, Banjara Hills" />
        </div>
        <div className="field">
          <span>Account holder's name *</span>
          <input value={draft.accountHolderName} onChange={(e) => set('accountHolderName', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <span>Account number *</span>
          <input value={draft.bankAccountNumber} onChange={(e) => set('bankAccountNumber', e.target.value)} inputMode="numeric" />
        </div>
        <div className="field">
          <span>IFSC code *</span>
          <input value={draft.ifsc} onChange={(e) => set('ifsc', e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-pri btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} disabled={!valid || saving} onClick={onSave}>{saving ? 'Saving…' : <>Save <Check size={14} /></>}</button>
        <button className="btn btn-ghost btn-sm" disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
