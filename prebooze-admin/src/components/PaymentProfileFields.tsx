import { useState } from 'react';
import { Copy, CheckCircle2, Eye, EyeOff, BadgeCheck } from 'lucide-react';
import type { LivePaymentProfile, LiveVenuePaymentProfile } from '../lib/liveApi';

export function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      style={{ padding: '2px 6px', fontSize: 11 }}
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy"
    >
      {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
    </button>
  );
}

/** Full account number, hidden by default (a shoulder-surf/screenshot
 * guard, not a real access control — the API already returned it in full
 * to anyone with view permission) with one click to reveal, plus a copy
 * button. Shared between PaymentDetails.tsx's standalone lookup and
 * Payments.tsx's inline expand-on-click — both need the exact same field. */
export function AccountNumberField({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 14, letterSpacing: 0.5 }}>
        {shown ? value : '•'.repeat(Math.max(4, value.length - 4)) + value.slice(-4)}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => setShown((s) => !s)} title={shown ? 'Hide' : 'Show'}>
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <CopyChip value={value} />
    </div>
  );
}

export function PaymentProfileRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid rgba(139,195,74,.08)' }}>
      <span className="tiny muted">{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, textAlign: 'right' }}>
        {value || '—'}
        {copyable && value && <CopyChip value={value} />}
      </span>
    </div>
  );
}

/** One organizer/venue payment profile, fully rendered — account number,
 * holder, IFSC, branch, PAN, GSTIN, address. Shared card so an organizer's
 * bank details look identical whether reached via the standalone Payment
 * details page or expanded inline in Payments.tsx's Payouts due tab. */
export function PaymentProfileCard({ profile }: { profile: LivePaymentProfile | LiveVenuePaymentProfile }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className="display" style={{ fontWeight: 700 }}>{profile.legalName}</span>
        {profile.isDefault && <span className="tag tag-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><BadgeCheck size={11} /> Default</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid rgba(139,195,74,.08)' }}>
        <span className="tiny muted">Account number</span>
        <AccountNumberField value={profile.bankAccountNumber} />
      </div>
      <PaymentProfileRow label="Account holder" value={profile.accountHolderName} />
      <PaymentProfileRow label="IFSC" value={profile.ifsc} copyable />
      <PaymentProfileRow label="Branch" value={profile.branch ?? ''} />
      <PaymentProfileRow label="PAN" value={profile.pan} copyable />
      <PaymentProfileRow label="GSTIN" value={profile.noGst ? 'Not registered' : (profile.gstin ?? '')} />
      <PaymentProfileRow label="Business address" value={[profile.businessAddress, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ')} />
    </div>
  );
}
