import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { fmtDate } from '../data/mock';
import { featured as featuredApi } from '../api';
import { ApiError } from '../api/client';
import type { Featured, FeaturedSubscription } from '../types';

const RATE_KEY: Record<Extract<Featured['type'], 'organizer' | 'promoter' | 'lineup' | 'venue'>, 'organizerMonthly' | 'promoterMonthly' | 'lineupMonthly' | 'venueMonthly'> = {
  organizer: 'organizerMonthly', promoter: 'promoterMonthly', lineup: 'lineupMonthly', venue: 'venueMonthly',
};
const POLL_MS = 3000;

/** "Get featured" purchase panel for organizer / promoter / line-up / venue
 * consoles — real Razorpay Subscription (e-mandate), same rails as the
 * paid plan tiers (SubscriptionPlans.tsx): POST /featured/subscribe hands
 * back a hosted `shortUrl`, the owner authorizes it in a new tab, and this
 * polls /featured/mine-subscription until the `subscription.activated`
 * webhook has flipped the real status. Once active it renews automatically
 * every month — no more manual "renew now" click, and no admin re-review
 * on each renewal (see FeaturedService.startPeriod). Rates come from the
 * real, admin-editable GET /featured/rates rather than a stale local
 * constant, since admin can change them at any time. */
export default function PromoteCard({
  type, refId, city, label,
}: {
  type: Extract<Featured['type'], 'organizer' | 'promoter' | 'lineup' | 'venue'>;
  refId: string;
  city: string;
  label: string; // e.g. "your brand", "your PR profile", "your artist profile"
}) {
  const [rec, setRec] = useState<Featured | null>(null);
  const [sub, setSub] = useState<FeaturedSubscription | null>(null);
  const [monthly, setMonthly] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [awaitingAuth, setAwaitingAuth] = useState<{ shortUrl: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useApp();

  const load = () => {
    Promise.all([featuredApi.mine(type, refId), featuredApi.mySubscription(type, refId), featuredApi.rates()])
      .then(([m, s, rates]) => {
        setRec(m);
        setSub(s);
        setMonthly(rates[RATE_KEY[type]]);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [type, refId]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startPolling = (shortUrl: string) => {
    setAwaitingAuth({ shortUrl });
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await featuredApi.mySubscription(type, refId);
        setSub(s);
        if (s && s.status !== 'created' && s.status !== 'authenticated') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setAwaitingAuth(null);
          setBusy(false);
          if (s.status === 'active') toast('Featured — auto-renew is on ✓');
          load();
        }
      } catch {
        // transient — keep polling, the next tick will retry
      }
    }, POLL_MS);
  };

  const subscribe = async () => {
    setErr('');
    setBusy(true);
    try {
      const res = await featuredApi.subscribe({ type, refId });
      if (res.requiresAuthorization && res.shortUrl) {
        window.open(res.shortUrl, '_blank', 'noopener');
        startPolling(res.shortUrl);
      } else {
        setBusy(false);
        load();
      }
    } catch (e) {
      setBusy(false);
      setErr(e instanceof ApiError ? e.message : 'Could not start subscription — try again');
    }
  };

  const cancel = async () => {
    if (!window.confirm('Stop auto-renewing? You stay featured until the current period ends, then it stops.')) return;
    setErr('');
    setBusy(true);
    try {
      await featuredApi.cancelSubscription(type, refId);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not cancel — try again');
    } finally {
      setBusy(false);
    }
  };

  if (loading || monthly == null) return null;

  const subActive = sub?.status === 'active';
  const subHalted = sub?.status === 'halted';
  const subPending = sub?.status === 'created' || sub?.status === 'authenticated' || sub?.status === 'pending';

  return (
    <div className="card" style={{ marginBottom: 18, borderColor: rec?.status === 'active' ? 'var(--accent)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3>Get featured ⭐</h3>
          <p className="muted small" style={{ marginTop: 4, maxWidth: 440 }}>
            Feature {label} on the {city} home page and directory — you jump to the front of your slider with a
            Featured badge. Billed monthly, renews automatically.
          </p>
        </div>
        {rec?.status === 'active' && subActive ? (
          <span className="badge badge-accent">★ Featured · auto-renews {sub!.currentEnd ? fmtDate(sub!.currentEnd) : ''}</span>
        ) : rec?.status === 'active' ? (
          <span className="badge badge-accent">★ Featured · until {fmtDate(rec.expiresAt)}</span>
        ) : rec?.status === 'pending' && rec.paid ? (
          <span className="badge badge-pending">Featured ◌ pending review</span>
        ) : subPending ? (
          <button className="btn btn-pri" disabled={busy} onClick={subscribe}>
            {busy ? 'Opening payment…' : 'Complete authorization →'}
          </button>
        ) : (
          <button className="btn btn-pri" disabled={busy} onClick={subscribe}>
            {busy ? 'Opening payment…' : `Feature for ₹${monthly.toLocaleString('en-IN')}/mo →`}
          </button>
        )}
      </div>
      {rec?.status === 'pending' && rec.paid && (
        <div className="tiny muted-2" style={{ marginTop: 10 }}>
          Paid ✓ — an admin reviews featured placements before they go live (usually within a day).
        </div>
      )}
      {subActive && (
        <div className="tiny muted-2" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>Auto-renews monthly at ₹{monthly.toLocaleString('en-IN')} · {sub!.paidCount} payment{sub!.paidCount === 1 ? '' : 's'} so far</span>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={cancel}>Cancel auto-renew</button>
        </div>
      )}
      {subHalted && (
        <div className="card" style={{ marginTop: 12, borderColor: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="tiny danger-text">Auto-renewal payment failed — {label} is no longer featured.</div>
          <button className="btn btn-pri btn-sm" disabled={busy} onClick={subscribe}>
            {busy ? 'Opening payment…' : `Resubscribe for ₹${monthly.toLocaleString('en-IN')}/mo →`}
          </button>
        </div>
      )}
      {awaitingAuth && (
        <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
          <p className="muted small" style={{ margin: 0 }}>
            Complete the authorization in the tab that just opened — this updates automatically once Razorpay
            confirms it.{' '}
            <a href={awaitingAuth.shortUrl} target="_blank" rel="noopener noreferrer" className="link">
              Reopen the payment page
            </a>
          </p>
        </div>
      )}
      {err && <div className="tiny danger-text" style={{ marginTop: 10 }}>✕ {err}</div>}
    </div>
  );
}
