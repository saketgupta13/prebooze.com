import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { SUB_TIERS } from '../../data/mock';

export default function PromoterDashboard() {
  const { user } = useApp();
  const plan = SUB_TIERS.find((t) => t.id === (user?.promoterPlan ?? 'free')) ?? SUB_TIERS[0];
  const guestsUsed = 0; // Phase 1: no promotions yet
  const quota = plan.guests < 0 ? '∞' : plan.guests;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>Hey, {user?.promoterBrand ?? 'promoter'} 📣</h1>
        <span className="badge badge-pending">Pending admin review ◌</span>
      </div>

      <div className="kpis" style={{ marginBottom: 18 }}>
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
          <div className="v">0</div>
        </div>
      </div>

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
