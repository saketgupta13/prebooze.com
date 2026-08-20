import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../data/mock';
import { promoter as promoterApi, type PromoterMe, type RoleSubscription, type SubTier } from '../../api';
import { ApiError } from '../../api/client';
import type { Event } from '../../types';
import Loader from '../../components/Loader';
import PromoteCard from '../../components/PromoteCard';
import { promoterPath } from '../../lib/urls';

export default function PromoterDashboard() {
  const [me, setMe] = useState<PromoterMe | null>(null);
  const [promotions, setPromotions] = useState<Event[]>([]);
  const [earnings, setEarnings] = useState({ perHead: 0, commission: 0, withdrawn: 0 });
  const [usage, setUsage] = useState({ used: 0, quota: -1 });
  const [tiers, setTiers] = useState<SubTier[]>([]);
  const [sub, setSub] = useState<RoleSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      promoterApi.me(),
      promoterApi.promotions(),
      promoterApi.earnings(),
      promoterApi.usage(),
      promoterApi.subscription.tiers(),
      promoterApi.subscription.mine(),
    ])
      .then(([m, p, e, u, t, s]) => {
        setMe(m);
        setPromotions(p);
        setEarnings(e);
        setUsage(u);
        setTiers(t);
        setSub(s);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (err || !me) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Profile not found'}</div>;

  const planName = sub?.tier.name ?? tiers.find((t) => t.price === 0)?.name ?? 'Free';
  const quota = usage.quota < 0 ? '∞' : usage.quota;
  const pct = usage.quota < 0 ? 0 : Math.min(100, Math.round((usage.used / Math.max(1, usage.quota)) * 100));
  const total = earnings.perHead + earnings.commission;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>Hey, {me.name} 📣</h1>
        {me.verified ? (
          <span className="badge badge-ok">Verified ✓</span>
        ) : (
          <Link to="/promoter/settings/verification" className="btn btn-pri btn-sm">Complete verification →</Link>
        )}
      </div>

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="l">Plan</div>
          <div className="v">{planName}</div>
        </div>
        <div className="kpi">
          <div className="l">Guests this month</div>
          <div className="v">{usage.used}<span className="muted small"> / {quota}</span></div>
        </div>
        <div className="kpi">
          <div className="l">Events promoting</div>
          <div className="v">{promotions.length}</div>
        </div>
        <div className="kpi">
          <div className="l">Earnings</div>
          <div className="v accent">{fmtMoney(total)}</div>
        </div>
      </div>

      {usage.quota >= 0 && (
        <div className="card" style={{ marginBottom: 18, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <span className="small bold">Monthly guest quota</span>
            <span className={usage.used >= usage.quota ? 'danger-text tiny bold' : 'muted tiny'}>
              {usage.used} / {usage.quota} used
              {usage.used >= usage.quota && ' · upgrade to add more'}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--border-dash)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: usage.used >= usage.quota ? 'var(--danger)' : 'var(--accent)', transition: 'width .3s' }} />
          </div>
          {usage.used >= usage.quota && (
            <Link to="/promoter/subscription" className="btn btn-pri btn-sm" style={{ marginTop: 10 }}>Upgrade plan →</Link>
          )}
        </div>
      )}

      <PromoteCard type="promoter" refId={me.slug} city={me.city || 'Hyderabad'} label="your PR profile" />

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 8 }}>How the promoter console works</h3>
        <div className="stack" style={{ display: 'grid', gap: 10 }}>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>1. Get invited to events</b> — organizers add you to an event's promoter allow-list and enable Guest
            list (free entry), Paid commission (a % on ticket sales through your link), or both. Approved events show
            under <Link to="/promoter/promotions" className="link">My promotions</Link>.
          </div>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>2. Share the right link</b> — on <Link to="/promoter/promotions" className="link">My promotions</Link>, each
            event gives you a free-entry link, a paid-ticket link, or both (shown as separate tabs when you have
            both) — only send the ticket link if you want the revenue-share cut.
          </div>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>3. Guests join, you watch arrivals</b> — guests fill their details and get a time-based QR. Open{' '}
            <Link to="/promoter/promotions" className="link">a specific event</Link>'s guest list to see who's
            joined and check them in live at the gate.
          </div>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>4. Track what you've earned</b> — <Link to="/promoter/earnings" className="link">Earnings</Link> breaks
            down per-head guest-list pay and revenue-share commission, per event and per organizer. Organizers pay
            you directly (Prebooze doesn't move this money) — mark a payout received or send a reminder from there.
          </div>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>5. Bring on a team</b> — if an organizer allows it, add sub-promoters under{' '}
            <Link to="/promoter/team" className="link">Team</Link> so guests they bring are credited separately on
            the same event.
          </div>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>6. Build your reputation</b> — the <Link to="/promoter/leaderboard" className="link">Leaderboard</Link> ranks
            promoters by show-up rate (guests who actually arrive). A high rate gets you invited to more events.
          </div>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>7. Raise your monthly guest quota</b> — <Link to="/promoter/subscription" className="link">Subscription</Link> sets
            how many guests you can add to lists each month; upgrade any time.
          </div>
          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, fontSize: 13 }}>
            <b>8. Keep your profile current</b> — <Link to="/promoter/settings" className="link">Settings</Link> holds
            your bio, links, audience reach, and the bank details organizers pay out to.
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3>Your public profile</h3>
            <p className="muted small" style={{ marginTop: 4 }}>guests can follow you and get your lists first</p>
          </div>
          <Link to={promoterPath(me.city || 'Hyderabad', me.slug)} className="btn btn-ghost btn-sm">View / share →</Link>
        </div>
      </div>
    </div>
  );
}
