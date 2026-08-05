import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { ApiError } from '../api/client';
import type { RoleSubscription, SubTier } from '../api';

const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface SubscriptionApi {
  tiers: () => Promise<SubTier[]>;
  mine: () => Promise<RoleSubscription | null>;
  subscribe: (tierId: string) => Promise<{ ok: boolean; requiresAuthorization: boolean; shortUrl?: string }>;
  cancel: () => Promise<{ ok: boolean }>;
}

/** Shared real, Razorpay-backed subscription UI for organizer/promoter/venue/
 * lineup — one component instead of four near-identical pages, since the
 * billing mechanics (SubscriptionsService) are role-agnostic on the backend
 * too. Paid tiers hand back a hosted Razorpay `shortUrl`; there's no
 * client-side Checkout.js widget for recurring Subscriptions the way there
 * is for one-time Orders, so the standard integration is: send the owner to
 * the hosted page in a new tab, then poll `mine()` until the
 * `subscription.activated` webhook has flipped the real status — nothing
 * here ever grants the tier optimistically. */
export default function SubscriptionPlans({
  api,
  usage,
}: {
  api: SubscriptionApi;
  usage?: { used: number; quota: number } | null;
}) {
  const { toast } = useApp();
  const [tiers, setTiers] = useState<SubTier[]>([]);
  const [current, setCurrent] = useState<RoleSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyTierId, setBusyTierId] = useState<string | null>(null);
  const [awaitingAuth, setAwaitingAuth] = useState<{ tierName: string; shortUrl: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([api.tiers(), api.mine()])
      .then(([t, c]) => {
        setTiers(t);
        setCurrent(c);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load plans'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = (tierName: string, shortUrl: string) => {
    setAwaitingAuth({ tierName, shortUrl });
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const c = await api.mine();
        setCurrent(c);
        if (c && c.status !== 'created' && c.status !== 'authenticated') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setAwaitingAuth(null);
          if (c.status === 'active') toast(`${tierName} plan activated ✓`);
        }
      } catch {
        // transient — keep polling, the next tick will retry
      }
    }, 3000);
  };

  const subscribe = async (tier: SubTier) => {
    setBusyTierId(tier.id);
    setErr('');
    try {
      const res = await api.subscribe(tier.id);
      if (res.requiresAuthorization) {
        if (res.shortUrl) window.open(res.shortUrl, '_blank', 'noopener');
        startPolling(tier.name, res.shortUrl ?? '');
      } else {
        toast(`Switched to ${tier.name} ✓`);
        load();
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not start subscription — try again');
    } finally {
      setBusyTierId(null);
    }
  };

  const cancel = async () => {
    setErr('');
    try {
      await api.cancel();
      toast('Subscription will end at the current billing cycle');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not cancel — try again');
    }
  };

  if (loading) return <div className="muted small">Loading plans…</div>;

  // Only 'active'/'pending' mean this tier is genuinely applied — subscribe()
  // overwrites RoleSubscription.tierId to the NEW tier the instant you click
  // Upgrade, status: 'created', well before any payment. If you back out
  // without paying, that row is stuck in 'created'/'authenticated' forever
  // (Razorpay never fires another webhook for an abandoned authorization),
  // so trusting any non-cancelled/non-expired status here showed the unpaid
  // tier as "Current". Every other non-active status (created, authenticated,
  // halted, cancelled, expired) means you're really back on the free tier —
  // matches what SubscriptionsService.demoteToFree already does for real.
  const activeTierId =
    current?.status === 'active' || current?.status === 'pending' ? current.tierId : tiers.find((t) => t.price === 0)?.id ?? null;

  return (
    <div>
      {err && (
        <div className="danger-text small" style={{ marginBottom: 14 }}>
          ✕ {err}
        </div>
      )}

      {awaitingAuth && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <b>Waiting for payment confirmation…</b>
          <p className="muted small" style={{ marginTop: 4 }}>
            Complete the {awaitingAuth.tierName} plan authorization in the tab that just opened — this updates
            automatically once Razorpay confirms it.
            {awaitingAuth.shortUrl && (
              <>
                {' '}
                <a href={awaitingAuth.shortUrl} target="_blank" rel="noopener noreferrer" className="link">
                  Reopen the payment page
                </a>
              </>
            )}
          </p>
        </div>
      )}

      {usage && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <b>Guests this month</b>
            <span className={usage.quota >= 0 && usage.used >= usage.quota ? 'danger-text small bold' : 'muted small'}>
              {usage.used} / {usage.quota < 0 ? '∞' : usage.quota}
              {usage.quota >= 0 && usage.used >= usage.quota && ' · limit reached'}
            </span>
          </div>
          {usage.quota >= 0 && (
            <div style={{ height: 8, borderRadius: 999, background: 'var(--border-dash)', marginTop: 8, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.round((usage.used / Math.max(1, usage.quota)) * 100))}%`,
                  height: '100%',
                  background: usage.used >= usage.quota ? 'var(--danger)' : 'var(--accent)',
                  transition: 'width .3s',
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {tiers.map((t) => {
          const active = activeTierId === t.id;
          return (
            <div key={t.id} className="card" style={{ borderColor: active ? 'var(--accent)' : undefined, position: 'relative' }}>
              {active && (
                <span className="badge badge-accent" style={{ position: 'absolute', top: 14, right: 14 }}>
                  Current
                </span>
              )}
              <h3 style={{ fontSize: 18 }}>{t.name}</h3>
              <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0' }}>
                {t.price === 0 ? 'Free' : fmtMoney(t.price)}
                {t.price > 0 && <span className="muted small" style={{ fontWeight: 400 }}> / mo</span>}
              </div>
              {t.guests != null && (
                <div className="accent bold small" style={{ marginBottom: 10 }}>
                  {t.guests < 0 ? 'Unlimited guests' : `${t.guests} guests / month`}
                </div>
              )}
              <button
                className={`btn ${active ? 'btn-ghost' : 'btn-pri'} btn-block`}
                disabled={active || busyTierId === t.id}
                onClick={() => subscribe(t)}
              >
                {active ? 'Current plan' : busyTierId === t.id ? 'Starting…' : t.price === 0 ? 'Switch to Free' : `Upgrade to ${t.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {activeTierId && current && current.tier.price > 0 && current.status === 'active' && (
        <div className="card" style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h3>Cancel subscription</h3>
            <p className="muted small" style={{ marginTop: 4 }}>
              You'll keep {current.tier.name} until the current billing cycle ends, then drop to Free.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={cancel}>
            Cancel plan
          </button>
        </div>
      )}

      <div className="tiny muted-2" style={{ marginTop: 14 }}>
        🔒 real billing via Razorpay Subscriptions · tiers &amp; prices are configurable by admin
      </div>
    </div>
  );
}
