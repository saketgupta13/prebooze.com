import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmtMoney } from '../../data/mock';
import Loader from '../../components/Loader';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';

/** Withdraw available hosting balance — real POST /venue/hosting/withdraw.
 * Same shape as organizer/Withdraw.tsx: settlement itself is manual on our
 * side, so this doesn't claim an instant transfer mode. Pays out to
 * whichever payment profile is default — same source of truth the backend
 * itself checks. */
export default function VenueWithdraw() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [defaultBankLast4, setDefaultBankLast4] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('0');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([venuePartner.myLedger(), venuePartner.paymentProfiles()])
      .then(([l, profiles]) => {
        setBalance(l.balance);
        setAmount(String(l.balance));
        setDefaultBankLast4(profiles.find((p) => p.isDefault)?.bankLast4 ?? null);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const amt = parseInt(amount.replace(/\D/g, ''), 10) || 0;
  const valid = amt > 0 && amt <= balance;

  const confirm = async () => {
    setErr('');
    setSubmitting(true);
    try {
      await venuePartner.withdraw(amt);
      navigate('/venue/hosting/ledger');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Withdrawal failed');
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/venue/hosting/ledger">← Hosting ledger</Link> / Withdraw
      </div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Withdraw to bank</h1>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

      <div className="card" style={{ maxWidth: 480, marginBottom: 16 }}>
        <div className="kv">
          <span className="k">Available balance</span>
          <span className="bold accent">{fmtMoney(balance)}</span>
        </div>
        <div className="kv">
          <span className="k">Payout account</span>
          <span>{defaultBankLast4 ? <>•••• {defaultBankLast4} <span className="verified">✓</span></> : 'No payment profile on file — add one in Settings'}</span>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <span>Amount to withdraw</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </div>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {[25, 50, 100].map((pct) => (
            <button key={pct} className="chip" onClick={() => setAmount(String(Math.floor((balance * pct) / 100)))}>
              {pct === 100 ? 'All' : `${pct}%`}
            </button>
          ))}
        </div>
        {amt > balance && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ More than your available balance</div>}

        {!confirming ? (
          <button className="btn btn-pri btn-block btn-lg" disabled={!valid} onClick={() => setConfirming(true)}>
            Withdraw {fmtMoney(amt)} →
          </button>
        ) : (
          <div className="card" style={{ background: 'var(--surface-2)', padding: 14 }}>
            <div className="small" style={{ marginBottom: 10 }}>
              Request a withdrawal of <b>{fmtMoney(amt)}</b> to {defaultBankLast4 ? `•••• ${defaultBankLast4}` : 'your account on file'}? Our team processes it from here.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-pri" style={{ flex: 1 }} disabled={submitting} onClick={confirm}>
                {submitting ? 'Submitting…' : 'Confirm ✓'}
              </button>
              <button className="btn btn-ghost" disabled={submitting} onClick={() => setConfirming(false)}>Back</button>
            </div>
          </div>
        )}
        <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
          🔒 payouts settle only to the account on file for your venue profile
        </div>
      </div>
    </div>
  );
}
