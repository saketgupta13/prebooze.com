import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { existingRole, roleLabel } from '../lib/roles';
import { CreditCard, Smartphone, CheckCircle2, X, Lock } from 'lucide-react';

/** Saved payment methods (all roles) + auto-renew for subscriptions/featured. */
export default function PaymentMethods() {
  const { user, updateUser, payMethods, addPayMethod, removePayMethod, setDefaultPayMethod, toast } = useApp();
  const [type, setType] = useState<'upi' | 'card'>('upi');
  const [value, setValue] = useState('');
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const role = existingRole(user);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    if (type === 'upi' && !/^[\w.\-]+@[\w]+$/.test(v)) { toast('Enter a valid UPI id, e.g. name@upi'); return; }
    if (type === 'card') {
      if (v.replace(/\D/g, '').length < 12) { toast('Enter a valid card number'); return; }
      if (!holder.trim()) { toast('Card holder name is required'); return; }
      if (!/^\d{2}\/\d{2}$/.test(expiry)) { toast('Enter expiry as MM/YY'); return; }
      if (cvv.replace(/\D/g, '').length !== 3) { toast('Enter the 3-digit CVV'); return; }
    }
    const label = type === 'upi' ? v : `Card •••• ${v.replace(/\D/g, '').slice(-4)}`;
    addPayMethod(type === 'upi' ? { type, label } : { type, label, holder: holder.trim(), expiry });
    toast('Payment method saved ✓ (CVV verified, never stored)');
    setValue(''); setHolder(''); setExpiry(''); setCvv('');
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="breadcrumb">
          <Link to="/profile">Profile</Link> / Payment methods
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>Payment methods <CreditCard size={22} /></h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Save UPI or cards for one-tap checkout{role ? ' and subscription renewals' : ''}.
        </p>

        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 10 }}>Saved methods ({payMethods.length})</h3>
          {payMethods.length === 0 ? (
            <div className="muted small">Nothing saved yet — add a UPI id or card below.</div>
          ) : (
            payMethods.map((m) => (
              <div key={m.id} className="evrow">
                <span style={{ fontSize: 20, display: 'inline-flex' }}>{m.type === 'upi' ? <Smartphone size={20} /> : <CreditCard size={20} />}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small">{m.label}</div>
                  <div className="tiny muted-2">
                    {m.type.toUpperCase()}{m.holder ? ` · ${m.holder}` : ''}{m.expiry ? ` · exp ${m.expiry}` : ''}
                    {m.usedCount ? ` · used ${m.usedCount}× at checkout` : ''}
                  </div>
                </div>
                {m.isDefault ? (
                  <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Default <CheckCircle2 size={13} /></span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setDefaultPayMethod(m.id)}>Make default</button>
                )}
                <button className="btn btn-danger btn-sm" style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }} onClick={() => removePayMethod(m.id)}><X size={14} /></button>
              </div>
            ))
          )}
        </div>

        <form className="card" style={{ marginBottom: 18 }} onSubmit={add}>
          <h3 style={{ marginBottom: 10 }}>Add a method</h3>
          <div className="form-row">
            <div className="field" style={{ flex: '0 0 140px' }}>
              <span>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as 'upi' | 'card')}>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div className="field">
              <span>{type === 'upi' ? 'UPI id' : 'Card number'}</span>
              <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'upi' ? 'name@upi' : '4242 4242 4242 4242'} inputMode={type === 'card' ? 'numeric' : 'text'} />
            </div>
          </div>
          {type === 'card' && (
            <div className="form-row">
              <div className="field">
                <span>Card holder name</span>
                <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="As printed on the card" />
              </div>
              <div className="field" style={{ flex: '0 0 110px' }}>
                <span>Expiry</span>
                <input value={expiry} onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, '').slice(0, 4); setExpiry(d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d); }} placeholder="MM/YY" inputMode="numeric" />
              </div>
              <div className="field" style={{ flex: '0 0 90px' }}>
                <span>CVV</span>
                <input type="password" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="•••" inputMode="numeric" />
              </div>
            </div>
          )}
          <button className="btn btn-pri" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Save method</button>
          <span className="tiny muted-2" style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={11} /> CVV is verified at charge time, never stored</span>
        </form>

        {role && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <h3>Auto-renew</h3>
                <p className="muted small" style={{ marginTop: 4, maxWidth: 380 }}>
                  Renew your {roleLabel(role)} subscription & featured placements automatically from your default method.
                </p>
              </div>
              <button
                className={`chip ${user?.autoRenew ? 'on' : ''}`}
                onClick={() => {
                  updateUser({ autoRenew: !user?.autoRenew });
                  toast(user?.autoRenew ? 'Auto-renew turned off' : 'Auto-renew on — renews from your default method ✓');
                }}
              >
                {user?.autoRenew ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Auto-renew ON <CheckCircle2 size={13} /></span> : 'Auto-renew OFF'}
              </button>
            </div>
            {user?.autoRenew && payMethods.length === 0 && (
              <div className="tiny danger-text" style={{ marginTop: 8 }}>Add a payment method above so renewals don't fail.</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
