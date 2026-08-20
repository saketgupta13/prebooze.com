import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { fmtMoney } from '../data/mock';
import { cityBrowse } from '../lib/urls';

const TX_META: Record<string, { icon: string; label: string }> = {
  referral_welcome: { icon: '🎁', label: 'Welcome credit' },
  referral_reward: { icon: '🤝', label: 'Referral reward' },
  refund: { icon: '↩️', label: 'Refund' },
  spend: { icon: '🎟️', label: 'Spent at checkout' },
};

/** Prebooze wallet — store credits from referrals & refunds, spent at checkout. */
export default function Wallet() {
  const { walletTxs, walletBalance, city } = useApp();

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="breadcrumb">
          <Link to="/profile">Profile</Link> / Wallet
        </div>

        <div className="card card-shadow" style={{ textAlign: 'center', marginBottom: 18, padding: '26px 20px' }}>
          <div className="tiny muted-2">PREBOOZE WALLET</div>
          <div style={{ fontSize: 38, fontWeight: 800, margin: '6px 0' }} className="accent">{fmtMoney(walletBalance)}</div>
          <div className="small muted">auto-applies at checkout · earned from referrals &amp; refunds</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <Link to="/refer" className="btn btn-pri btn-sm">🎁 Refer & earn more →</Link>
            <Link to={cityBrowse(city)} className="btn btn-ghost btn-sm">Spend on events →</Link>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Transactions</h3>
          {walletTxs.length === 0 ? (
            <div className="muted small">
              No transactions yet — <Link to="/refer" className="link">refer a friend</Link> to earn your first credit,
              or get instant refunds here when you cancel a booking.
            </div>
          ) : (
            walletTxs.map((t) => {
              const meta = TX_META[t.type] ?? { icon: '•', label: t.type };
              return (
                <div key={t.id} className="evrow">
                  <span style={{ fontSize: 20 }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bold small">{meta.label}</div>
                    <div className="tiny muted-2">{t.note} · {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <span className={`bold ${t.amount >= 0 ? 'accent' : 'danger-text'}`}>
                    {t.amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(t.amount))}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div className="tiny muted-2" style={{ marginTop: 10 }}>
          credits are spend-only (not withdrawable) · refunds can also go back to your payment method — your choice at cancellation
        </div>
      </div>
    </main>
  );
}
