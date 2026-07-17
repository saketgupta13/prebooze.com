import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { REFERRAL_CONFIG, fmtMoney } from '../data/mock';

const mask = (phone: string) => phone.slice(0, 7) + '••••' + phone.slice(-2);

/** Refer & Earn — share your link, both sides earn wallet credit. */
export default function ReferEarn() {
  const { user, myReferralCode, referrals, walletBalance } = useApp();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/r/${myReferralCode}`;
  const mine = referrals.filter((r) => r.referrerPhone === user?.phone);
  const qualified = mine.filter((r) => r.status === 'qualified');
  const earned = qualified.length * REFERRAL_CONFIG.referrer;

  const copy = () => {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const waShare = () =>
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Join me on Prebooze 🎟️ — sign up with my link and get ₹${REFERRAL_CONFIG.referee} off your first event: ${link}`)}`,
      '_blank'
    );

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="breadcrumb">
          <Link to="/profile">Profile</Link> / Refer &amp; earn
        </div>

        <div className="card card-shadow" style={{ textAlign: 'center', marginBottom: 18, padding: '26px 20px' }}>
          <div style={{ fontSize: 38 }}>🎁</div>
          <h1 style={{ fontSize: 24, margin: '6px 0' }}>Give ₹{REFERRAL_CONFIG.referee}, get ₹{REFERRAL_CONFIG.referrer}</h1>
          <p className="muted small" style={{ maxWidth: 420, margin: '0 auto 16px' }}>
            Your friend gets <b>₹{REFERRAL_CONFIG.referee} wallet credit</b> on signup — you earn{' '}
            <b>₹{REFERRAL_CONFIG.referrer}</b> when they make their first booking.
          </p>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--accent)', borderRadius: 10, padding: '10px 12px', fontSize: 13, wordBreak: 'break-all', marginBottom: 12 }}>
            {link}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-whatsapp" onClick={waShare}>💬 Share on WhatsApp</button>
            <button className="btn btn-ghost" onClick={copy}>{copied ? 'Copied ✓' : '🔗 Copy link'}</button>
          </div>
        </div>

        <div className="kpis" style={{ marginBottom: 18 }}>
          <div className="kpi"><div className="l">Friends joined</div><div className="v">{mine.length}</div></div>
          <div className="kpi"><div className="l">Booked (qualified)</div><div className="v accent">{qualified.length}</div></div>
          <div className="kpi"><div className="l">Credits earned</div><div className="v accent">{fmtMoney(earned)}</div></div>
          <div className="kpi">
            <div className="l">Wallet balance</div>
            <div className="v">{fmtMoney(walletBalance)}</div>
            <Link to="/wallet" className="link tiny bold">View wallet →</Link>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 10 }}>How it works</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['🔗', 'Share your link', 'Send it to friends on WhatsApp — one tap.'],
              ['👋', `Friend joins, gets ₹${REFERRAL_CONFIG.referee}`, 'Their welcome credit lands in their wallet instantly.'],
              [
                '🎟️',
                `They book, you earn ₹${REFERRAL_CONFIG.referrer}`,
                'When they pay for their first ticket, your reward hits your wallet.',
              ],
            ].map(([icon, t, d], i) => (
              <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className="num" style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                <div>
                  <div className="bold small">{icon} {t}</div>
                  <div className="tiny muted-2">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Your referrals ({mine.length})</h3>
          {mine.length === 0 ? (
            <div className="muted small">Nobody yet — share your link and your friends show up here.</div>
          ) : (
            mine.map((r) => (
              <div key={r.refereePhone} className="evrow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small">{r.refereeName || mask(r.refereePhone)}</div>
                  <div className="tiny muted-2">joined {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                </div>
                {r.status === 'qualified' ? (
                  <span className="badge badge-ok">Booked ✓ · +{fmtMoney(REFERRAL_CONFIG.referrer)}</span>
                ) : (
                  <span className="badge badge-pending">Joined · waiting on first booking</span>
                )}
              </div>
            ))
          )}
        </div>
        <div className="tiny muted-2" style={{ marginTop: 10 }}>
          one reward per referred phone · self-referrals blocked · credits are spend-only at checkout
        </div>
      </div>
    </main>
  );
}
