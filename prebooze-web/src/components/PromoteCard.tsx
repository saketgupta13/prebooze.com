import { useEffect, useState } from 'react';
import { useApp } from '../store/AppContext';
import { fmtDate } from '../data/mock';
import { featured as featuredApi } from '../api';
import { ApiError } from '../api/client';
import { loadRazorpayScript, getRazorpay } from '../lib/razorpay';
import type { Featured } from '../types';

const RATE_KEY: Record<Extract<Featured['type'], 'organizer' | 'promoter' | 'lineup' | 'venue'>, 'organizerMonthly' | 'promoterMonthly' | 'lineupMonthly' | 'venueMonthly'> = {
  organizer: 'organizerMonthly', promoter: 'promoterMonthly', lineup: 'lineupMonthly', venue: 'venueMonthly',
};
const RENEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // matches CronService.featuredExpiringSoonTick

/** "Get featured" purchase panel for organizer / promoter / line-up / venue
 * consoles — real Razorpay payment (POST /featured/request → Checkout.js →
 * POST /featured/:id/confirm-payment), same widget as ticket checkout. Rates
 * come from the real, admin-editable GET /featured/rates rather than a
 * stale local constant, since admin can change them at any time. */
export default function PromoteCard({
  type, refId, city, label,
}: {
  type: Extract<Featured['type'], 'organizer' | 'promoter' | 'lineup' | 'venue'>;
  refId: string;
  city: string;
  label: string; // e.g. "your brand", "your PR profile", "your artist profile"
}) {
  const { user, toast } = useApp();
  const [rec, setRec] = useState<Featured | null>(null);
  const [monthly, setMonthly] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    Promise.all([featuredApi.mine(type, refId), featuredApi.rates()])
      .then(([m, rates]) => {
        setRec(m);
        setMonthly(rates[RATE_KEY[type]]);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [type, refId]);

  const pay = async () => {
    setErr('');
    setBusy(true);
    try {
      const row = await featuredApi.request({ type, refId, billing: 'monthly' });
      await loadRazorpayScript();
      const Razorpay = getRazorpay();
      const rzp = new Razorpay({
        key: row.razorpayOrder.keyId,
        order_id: row.razorpayOrder.orderId,
        amount: row.razorpayOrder.amount,
        currency: 'INR',
        name: 'Prebooze',
        description: `Get featured — ${label}`,
        prefill: { name: user?.name, contact: user?.phone, email: user?.email || undefined },
        theme: { color: '#9be13d' },
        handler: async (resp: unknown) => {
          const r = resp as { razorpay_payment_id: string; razorpay_signature: string };
          try {
            await featuredApi.confirmPayment(row.id, { paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
            toast('Payment received — featured request sent for review ✓');
            load();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Payment succeeded but confirmation failed — contact support');
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', () => {
        setBusy(false);
        setErr('Payment failed or was cancelled');
      });
      rzp.open();
    } catch (e) {
      setBusy(false);
      setErr(e instanceof ApiError ? e.message : 'Could not start payment — try again');
    }
  };

  if (loading || monthly == null) return null;

  const expiringSoon = rec?.status === 'active' && new Date(rec.expiresAt).getTime() - Date.now() < RENEW_WINDOW_MS;

  return (
    <div className="card" style={{ marginBottom: 18, borderColor: rec ? 'var(--accent)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3>Get featured ⭐</h3>
          <p className="muted small" style={{ marginTop: 4, maxWidth: 440 }}>
            Feature {label} on the {city} home page and directory — you jump to the front of your slider with a
            Featured badge. Billed monthly.
          </p>
        </div>
        {rec?.status === 'active' && !expiringSoon ? (
          <span className="badge badge-accent">★ Featured · until {fmtDate(rec.expiresAt)}</span>
        ) : rec?.status === 'pending' && rec.paid ? (
          <span className="badge badge-pending">Featured ◌ pending review</span>
        ) : (
          <button className="btn btn-pri" disabled={busy} onClick={pay}>
            {busy ? 'Opening payment…' : `Feature for ₹${monthly.toLocaleString('en-IN')}/mo →`}
          </button>
        )}
      </div>
      {rec?.status === 'pending' && rec.paid && (
        <div className="tiny muted-2" style={{ marginTop: 10 }}>
          Paid ✓ — an admin reviews featured placements before they go live (usually within a day).
        </div>
      )}
      {expiringSoon && (
        <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="tiny">
            <b>Expiring {fmtDate(rec!.expiresAt)}</b> — renew now to stay featured without a gap.
          </div>
          <button className="btn btn-pri btn-sm" disabled={busy} onClick={pay}>
            {busy ? 'Opening payment…' : `Renew for ₹${monthly.toLocaleString('en-IN')}/mo →`}
          </button>
        </div>
      )}
      {err && <div className="tiny danger-text" style={{ marginTop: 10 }}>✕ {err}</div>}
    </div>
  );
}
