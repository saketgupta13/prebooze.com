import { useApp } from '../../store/AppContext';
import { SUB_TIERS, fmtMoney } from '../../data/mock';
import { guestsThisMonth, planQuota } from '../../lib/promoterEarnings';
import { notify } from '../../lib/notify';

export default function PromoterSubscription() {
  const { user, updateUser, setPromoterPlan, promoterGuests, toast } = useApp();
  const current = user?.promoterPlan ?? 'free';
  const mySlug = user?.promoterUsername ?? '';
  const used = guestsThisMonth(promoterGuests, mySlug);
  const quota = planQuota(current);
  const pct = quota < 0 ? 0 : Math.min(100, Math.round((used / Math.max(1, quota)) * 100));
  const overish = quota >= 0 && used >= quota * 0.8;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Subscription</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Your plan sets how many guests you can add to lists each month. Upgrade any time — changes apply instantly.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
          <b>Guests this month</b>
          <span className={overish ? 'danger-text small bold' : 'muted small'}>
            {used} / {quota < 0 ? '∞' : quota}
            {quota >= 0 && used >= quota && ' · limit reached'}
          </span>
        </div>
        {quota >= 0 && (
          <div style={{ height: 8, borderRadius: 999, background: 'var(--border-dash)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: used >= quota ? 'var(--danger)' : 'var(--accent)', transition: 'width .3s' }} />
          </div>
        )}
        <div className="tiny muted-2" style={{ marginTop: 8 }}>
          {quota < 0
            ? 'Unlimited guests on your current plan.'
            : used >= quota
              ? 'You’ve hit your monthly cap — new guests can’t join your lists until you upgrade or the month resets.'
              : `${quota - used} more guests can join your lists this month.`}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {SUB_TIERS.map((t) => {
          const active = current === t.id;
          return (
            <div
              key={t.id}
              className="card"
              style={{ borderColor: active ? 'var(--accent)' : undefined, position: 'relative' }}
            >
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
              <div className="accent bold small" style={{ marginBottom: 10 }}>
                {t.guests < 0 ? 'Unlimited guests' : `${t.guests} guests / month`}
              </div>
              <ul style={{ listStyle: 'none', display: 'grid', gap: 6, marginBottom: 14 }}>
                {t.perks.map((p) => (
                  <li key={p} className="small muted">
                    <span className="accent">✓</span> {p}
                  </li>
                ))}
              </ul>
              <button
                className={`btn ${active ? 'btn-ghost' : 'btn-pri'} btn-block`}
                disabled={active}
                onClick={() => {
                  updateUser({ promoterPlan: t.id });
                  if (mySlug) setPromoterPlan(mySlug, t.id);
                  if (user) notify(user.phone, 'subscription_receipt', { plan: t.name, price: String(t.price), quota: t.guests < 0 ? 'unlimited' : String(t.guests) }, user.email || undefined);
                  toast(`Switched to ${t.name} ✓`);
                }}
              >
                {active ? 'Current plan' : t.price === 0 ? 'Downgrade to Free' : `Upgrade to ${t.name}`}
              </button>
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3>Auto-renew</h3>
          <p className="muted small" style={{ marginTop: 4 }}>
            Renew this plan automatically each month from your{' '}
            <a href="/payment-methods" className="link">default payment method</a>.
          </p>
        </div>
        <button
          className={`chip ${user?.autoRenew ? 'on' : ''}`}
          onClick={() => {
            updateUser({ autoRenew: !user?.autoRenew });
            if (!user?.autoRenew && user) notify(user.phone, 'auto_renew_on', { what: 'promoter subscription' }, user.email || undefined);
            toast(user?.autoRenew ? 'Auto-renew turned off' : 'Auto-renew on ✓');
          }}
        >
          {user?.autoRenew ? 'Auto-renew ON ✓' : 'Auto-renew OFF'}
        </button>
      </div>

      <div className="tiny muted-2" style={{ marginTop: 14 }}>
        🔒 billing is simulated for now · real Razorpay subscriptions land with the backend · tiers &amp; prices are
        configurable by admin
      </div>
    </div>
  );
}
