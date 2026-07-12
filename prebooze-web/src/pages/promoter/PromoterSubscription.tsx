import { useApp } from '../../store/AppContext';
import { SUB_TIERS, fmtMoney } from '../../data/mock';

export default function PromoterSubscription() {
  const { user, updateUser, toast } = useApp();
  const current = user?.promoterPlan ?? 'free';

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Subscription</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        Your plan sets how many guests you can add to lists each month. Upgrade any time — changes apply instantly.
      </p>

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
                  toast(`Switched to ${t.name} ✓`);
                }}
              >
                {active ? 'Current plan' : t.price === 0 ? 'Downgrade to Free' : `Upgrade to ${t.name}`}
              </button>
            </div>
          );
        })}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 14 }}>
        🔒 billing is simulated for now · real Razorpay subscriptions land with the backend · tiers &amp; prices are
        configurable by admin
      </div>
    </div>
  );
}
