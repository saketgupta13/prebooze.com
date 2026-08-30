import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { REFERRAL_CONFIG } from '../data/mock';
import { cityBrowse } from '../lib/urls';
import { Gift, Ticket } from 'lucide-react';

/** Public referral landing — /r/:code. Saves the code so signup attributes the friend. */
export default function ReferralLanding() {
  const { code } = useParams();
  const { user, city } = useApp();

  useEffect(() => {
    if (code) localStorage.setItem('pb_pending_ref', JSON.stringify(code));
  }, [code]);

  return (
    <main className="page">
      <div className="container center" style={{ padding: '72px 0' }}>
        <div className="card card-shadow" style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--accent)' }}><Gift size={40} /></div>
          <h1 style={{ fontSize: 24, marginTop: 8 }}>You've been invited!</h1>
          <p className="muted" style={{ margin: '10px 0 4px' }}>
            A friend invited you to Prebooze — your city's events, one tap away.
          </p>
          <p style={{ marginBottom: 18 }}>
            Sign up now and get <b className="accent">₹{REFERRAL_CONFIG.referee} wallet credit</b> for your first booking. <Ticket size={14} style={{ verticalAlign: 'text-bottom' }} />
          </p>
          {user ? (
            <>
              <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
                You're already signed in — referral rewards are for new accounts only.
              </div>
              <Link to={cityBrowse(city)} className="btn btn-pri btn-lg">Browse events →</Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-pri btn-block btn-lg">Claim ₹{REFERRAL_CONFIG.referee} & sign up →</Link>
              <div className="tiny muted-2" style={{ marginTop: 10 }}>
                WhatsApp OTP login · credit lands in your wallet instantly after signup
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
