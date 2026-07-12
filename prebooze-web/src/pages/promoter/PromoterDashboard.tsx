import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, SUB_TIERS, fmtMoney } from '../../data/mock';
import { commissionEarnings, guestsThisMonth, perHeadEarnings, planQuota } from '../../lib/promoterEarnings';

export default function PromoterDashboard() {
  const { user, myEvents, promoterGuests, bookings } = useApp();
  const plan = SUB_TIERS.find((t) => t.id === (user?.promoterPlan ?? 'free')) ?? SUB_TIERS[0];
  const mySlug = user?.promoterUsername ?? '';
  const allEvents = [...myEvents, ...EVENTS.filter((e) => !myEvents.some((m) => m.id === e.id))];
  const promotingCount = allEvents.filter(
    (e) => e.status === 'approved' && e.promoterConfig?.enabled && e.promoterConfig.allowedPromoters.includes(mySlug)
  ).length;
  const guestsUsed = guestsThisMonth(promoterGuests, mySlug);
  const quotaNum = planQuota(plan.id);
  const quota = quotaNum < 0 ? '∞' : quotaNum;
  const pct = quotaNum < 0 ? 0 : Math.min(100, Math.round((guestsUsed / Math.max(1, quotaNum)) * 100));
  const earnings = perHeadEarnings(allEvents, promoterGuests, mySlug) + commissionEarnings(bookings, mySlug).amount;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>Hey, {user?.promoterBrand ?? 'promoter'} 📣</h1>
        <span className="badge badge-pending">Pending admin review ◌</span>
      </div>

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="l">Plan</div>
          <div className="v">{plan.name}</div>
        </div>
        <div className="kpi">
          <div className="l">Guests this month</div>
          <div className="v">{guestsUsed}<span className="muted small"> / {quota}</span></div>
        </div>
        <div className="kpi">
          <div className="l">Events promoting</div>
          <div className="v">{promotingCount}</div>
        </div>
        <div className="kpi">
          <div className="l">Earnings</div>
          <div className="v accent">{fmtMoney(earnings)}</div>
        </div>
      </div>

      {quotaNum >= 0 && (
        <div className="card" style={{ marginBottom: 18, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <span className="small bold">Monthly guest quota</span>
            <span className={guestsUsed >= quotaNum ? 'danger-text tiny bold' : 'muted tiny'}>
              {guestsUsed} / {quotaNum} used
              {guestsUsed >= quotaNum && ' · upgrade to add more'}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--border-dash)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: guestsUsed >= quotaNum ? 'var(--danger)' : 'var(--accent)', transition: 'width .3s' }} />
          </div>
          {guestsUsed >= quotaNum && (
            <Link to="/promoter/subscription" className="btn btn-pri btn-sm" style={{ marginTop: 10 }}>Upgrade plan →</Link>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Getting started</h3>
        <div className="stack" style={{ display: 'grid', gap: 10 }}>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>1. Get approved</b> — an admin reviews your KYC (usually within a day). You'll be notified on WhatsApp.
          </div>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>2. Get invited to events</b> — organizers enable promoter guest lists per event and add you to the allow-list. Approved events show under <Link to="/promoter/promotions" className="link">My promotions</Link>.
          </div>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>3. Share your link & fill the list</b> — every event gives you an affiliate link. Guests add their details, get a time-based QR, and you watch arrivals live. <span className="muted">(coming in the next update)</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3>Your public profile</h3>
            <p className="muted small" style={{ marginTop: 4 }}>guests can follow you and get your lists first</p>
          </div>
          <Link to={`/promoter/${user?.promoterUsername ?? 'nova-nights'}`} className="btn btn-ghost btn-sm">View / share →</Link>
        </div>
      </div>
    </div>
  );
}
