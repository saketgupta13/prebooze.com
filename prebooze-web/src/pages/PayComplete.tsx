import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

/** Where a guest lands after paying an organizer-sent offline payment link
 * (BookingsService.createOfflineBookingPaymentLink) — there's no logged-in
 * browser session driving this the way a normal checkout has (the guest
 * just tapped a WhatsApp link on their phone), so unlike Checkout.tsx's own
 * resume flow, this page does nothing but say "thanks" — the real booking
 * gets created by the same PhonePe webhook every online checkout already
 * relies on (reconcilePhonePePayment -> finalizeOfflineLinkBooking), and
 * the ticket goes out over WhatsApp + email from there, same as any other
 * confirmed booking. No holdId/order lookup needed here at all. */
export default function PayComplete() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 420, textAlign: 'center', paddingTop: 60 }}>
        <CheckCircle2 size={48} className="accent" style={{ marginBottom: 16 }} />
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Payment received</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Your ticket is on its way to your WhatsApp — usually within a minute or two. You'll also get an email copy
          if one's on file.
        </p>
        <Link to="/" className="btn btn-pri">Back to Prebooze</Link>
      </div>
    </main>
  );
}
