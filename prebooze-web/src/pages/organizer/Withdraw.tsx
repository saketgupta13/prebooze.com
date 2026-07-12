import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { fmtMoney } from '../../data/mock';

/** Withdraw available balance to the linked bank account. */
export default function Withdraw() {
  const { orgBalance, withdraw } = useApp();
  const navigate = useNavigate();
  const [amount, setAmount] = useState(String(orgBalance));
  const [confirming, setConfirming] = useState(false);

  const amt = parseInt(amount.replace(/\D/g, ''), 10) || 0;
  const valid = amt > 0 && amt <= orgBalance;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/organizer/payouts">← Payouts</Link> / Withdraw
      </div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Withdraw to bank</h1>

      <div className="card" style={{ maxWidth: 480, marginBottom: 16 }}>
        <div className="kv">
          <span className="k">Available balance</span>
          <span className="bold accent">{fmtMoney(orgBalance)}</span>
        </div>
        <div className="kv">
          <span className="k">Payout account</span>
          <span>HDFC •••• 8821 <span className="verified">✓</span></span>
        </div>
        <div className="kv">
          <span className="k">Transfer mode</span>
          <span>IMPS · usually instant, max 2h</span>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <span>Amount to withdraw</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </div>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {[25, 50, 100].map((pct) => (
            <button key={pct} className="chip" onClick={() => setAmount(String(Math.floor((orgBalance * pct) / 100)))}>
              {pct === 100 ? 'All' : `${pct}%`}
            </button>
          ))}
        </div>
        {amt > orgBalance && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ More than your available balance</div>}

        {!confirming ? (
          <button className="btn btn-pri btn-block btn-lg" disabled={!valid} onClick={() => setConfirming(true)}>
            Withdraw {fmtMoney(amt)} →
          </button>
        ) : (
          <div className="card" style={{ background: 'var(--surface-2)', padding: 14 }}>
            <div className="small" style={{ marginBottom: 10 }}>
              Transfer <b>{fmtMoney(amt)}</b> to HDFC •••• 8821 now? A UTR lands in your payout history.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-pri"
                style={{ flex: 1 }}
                onClick={() => {
                  withdraw(amt);
                  navigate('/organizer/payouts');
                }}
              >
                Confirm ✓
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Back</button>
            </div>
          </div>
        )}
        <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
          🔒 payouts settle only to your penny-drop-verified account
        </div>
      </div>
    </div>
  );
}
