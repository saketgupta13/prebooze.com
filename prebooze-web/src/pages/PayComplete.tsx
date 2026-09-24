import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Hourglass } from 'lucide-react';
import { bookings } from '../api';
import Loader from '../components/Loader';

type Phase = 'checking' | 'paid' | 'failed' | 'pending';

/** Where a guest lands after paying (or backing out of) an organizer-sent
 * offline payment link (BookingsService.createOfflineBookingPaymentLink) —
 * there's no logged-in guest browser session driving this the way a normal
 * checkout has (the guest just tapped a WhatsApp link on their phone), so
 * unlike Checkout.tsx's own resume flow, this can't call any authenticated
 * status check. The real booking gets created entirely by the PhonePe
 * webhook (reconcilePhonePePayment -> finalizeOfflineLinkBooking), and this
 * page just polls the public GET /pay/status/:holdId a few times to find
 * out what actually happened.
 *
 * Real bug found 2026-09-25: this page used to unconditionally say
 * "Payment received" the instant anyone landed on it — including a guest
 * who'd backed out of PhonePe without paying at all. Now it only claims
 * success once the backend confirms it. */
export default function PayComplete() {
  const [params] = useSearchParams();
  const holdId = params.get('holdId');
  const [phase, setPhase] = useState<Phase>('checking');

  useEffect(() => {
    if (!holdId) {
      setPhase('failed');
      return;
    }
    let cancelled = false;
    let attempt = 0;
    // PhonePe's webhook can lag a few seconds behind the guest's own
    // redirect back here — retries a handful of times before settling on
    // "pending" rather than declaring failure on the very first check.
    const check = async () => {
      try {
        const { status } = await bookings.offlinePaymentLinkStatus(holdId);
        if (cancelled) return;
        if (status === 'paid') { setPhase('paid'); return; }
        if (status === 'failed' || status === 'unknown') { setPhase('failed'); return; }
      } catch {
        // keep retrying — a transient network error isn't a real "failed"
      }
      attempt += 1;
      if (attempt >= 6) { setPhase('pending'); return; }
      setTimeout(check, 2000);
    };
    check();
    return () => { cancelled = true; };
  }, [holdId]);

  if (phase === 'checking') return <Loader />;

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 420, textAlign: 'center', paddingTop: 60 }}>
        {phase === 'paid' && (
          <>
            <CheckCircle2 size={48} className="accent" style={{ marginBottom: 16 }} />
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Payment received</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              Your ticket is on its way to your WhatsApp — usually within a minute or two. You'll also get an email copy
              if one's on file.
            </p>
            <p className="tiny muted-2" style={{ marginBottom: 24 }}>
              You can also log in on Prebooze with this same WhatsApp number (we'll text you an OTP) to see this and
              every other booking any time, under My Bookings.
            </p>
            <Link to="/login" className="btn btn-ghost btn-block" style={{ marginBottom: 10 }}>Log in to see my bookings</Link>
          </>
        )}
        {phase === 'failed' && (
          <>
            <XCircle size={48} style={{ marginBottom: 16, color: 'var(--danger)' }} />
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Payment not completed</h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              It looks like this payment didn't go through — nothing was charged and no booking was made. If you'd like
              to try again, ask the organizer to resend the payment link.
            </p>
          </>
        )}
        {phase === 'pending' && (
          <>
            <Hourglass size={48} style={{ marginBottom: 16, color: 'var(--muted)' }} />
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Still confirming</h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              We're still confirming your payment with the bank — if it went through, your ticket will land on WhatsApp
              shortly. If you don't hear anything in a few minutes, check with the organizer.
            </p>
          </>
        )}
        <Link to="/" className="btn btn-pri">Back to Prebooze</Link>
      </div>
    </main>
  );
}
