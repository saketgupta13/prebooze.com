import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { Kpi } from '../components/ui';
import type { ReferralRates } from '../types';

/** Refer & earn — program config (reward amounts) + platform-wide analytics. */
export default function Referrals() {
  const { adminReferrals, referralRates, updateReferralRate } = useAdmin();

  const qualified = adminReferrals.filter((r) => r.status === 'qualified');
  const conversion = adminReferrals.length ? Math.round((qualified.length / adminReferrals.length) * 100) : 0;
  // referee welcome credit issues on every join; referrer reward only on qualification
  const creditsIssued = adminReferrals.length * referralRates.referee + qualified.length * referralRates.referrer;

  const top = (() => {
    const m = new Map<string, { name: string; joined: number; qualified: number }>();
    adminReferrals.forEach((r) => {
      const cur = m.get(r.referrerPhone) ?? { name: r.referrer, joined: 0, qualified: 0 };
      cur.joined += 1;
      if (r.status === 'qualified') cur.qualified += 1;
      m.set(r.referrerPhone, cur);
    });
    return [...m.values()].sort((a, b) => b.qualified - a.qualified || b.joined - a.joined).slice(0, 5);
  })();
  const maxJoined = Math.max(...top.map((t) => t.joined), 1);

  const RATES: { key: keyof ReferralRates; label: string; hint: string }[] = [
    { key: 'referee', label: 'Friend (welcome credit)', hint: 'issued instantly on signup via a referral link' },
    { key: 'referrer', label: 'Referrer (reward)', hint: 'issued when the friend makes their first paid booking' },
  ];

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <div className="page-hd">
        <h1 className="page-title">Refer &amp; earn</h1>
        <span className="small muted">two-sided wallet credits · rates apply across the guest app</span>
      </div>

      <div className="kpi-grid">
        <Kpi label="Friends referred" value={fmt(adminReferrals.length)} />
        <Kpi label="Qualified (booked)" value={fmt(qualified.length)} delta={`${conversion}% conversion`} deltaColor="var(--green)" />
        <Kpi label="Credits issued" value={`₹${fmt(creditsIssued)}`} delta="welcome + rewards" deltaColor="var(--muted)" />
        <Kpi label="Cost / qualified user" value={`₹${fmt(qualified.length ? Math.round(creditsIssued / qualified.length) : 0)}`} />
      </div>

      {/* Reward config */}
      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Reward amounts</div>
        <div className="tiny hint" style={{ marginBottom: 10 }}>editable — the guest app charges/credits these amounts</div>
        <div className="two-col" style={{ gap: 12 }}>
          {RATES.map((r) => (
            <div className="field" key={r.key}>
              <label>{r.label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="muted">₹</span>
                <input
                  className="input"
                  style={{ padding: '6px 8px' }}
                  value={String(referralRates[r.key])}
                  inputMode="numeric"
                  onChange={(e) => updateReferralRate({ [r.key]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 } as Partial<ReferralRates>)}
                />
              </div>
              <span className="tiny muted" style={{ marginTop: 4 }}>{r.hint}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top referrers */}
      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Top referrers</div>
        <div className="stack" style={{ gap: 8 }}>
          {top.map((t, i) => (
            <div key={t.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <b>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {t.name}</b>
                <span className="muted">{t.joined} referred · {t.qualified} booked · ₹{fmt(t.qualified * referralRates.referrer)} earned</span>
              </div>
              <div style={{ height: 8, background: 'rgba(139,195,74,.12)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                <div style={{ width: `${(t.joined / maxJoined) * 100}%`, height: '100%', background: 'var(--green)', opacity: 0.5 + (t.joined / maxJoined) * 0.5 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All referrals */}
      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 620 }}>
          <span style={{ flex: 1.3 }}>Referrer</span>
          <span style={{ flex: 1.3 }}>Friend</span>
          <span style={{ flex: 0.8 }}>Joined</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1 }}>Credits</span>
        </div>
        {adminReferrals.map((r) => (
          <div key={r.id} className="trow" style={{ minWidth: 620 }}>
            <span style={{ flex: 1.3 }}>
              <b>{r.referrer}</b>
              <span className="tiny muted" style={{ display: 'block' }}>{r.referrerPhone}</span>
            </span>
            <span style={{ flex: 1.3 }}>
              {r.referee}
              <span className="tiny muted" style={{ display: 'block' }}>{r.refereePhone}</span>
            </span>
            <span style={{ flex: 0.8 }} className="muted">{r.joinedAt}</span>
            <span style={{ flex: 1 }}>
              {r.status === 'qualified' ? <span className="tag tag-green">qualified ✓</span> : <span className="tag" style={{ borderColor: 'var(--border)' }}>joined</span>}
            </span>
            <span style={{ flex: 1 }} className="muted">
              ₹{fmt(referralRates.referee + (r.status === 'qualified' ? referralRates.referrer : 0))}
            </span>
          </div>
        ))}
      </div>
      <div className="tiny hint">
        welcome credit issues on signup · referrer reward only after the friend's first paid booking · self-referrals and duplicate phones are blocked in the app
      </div>
    </div>
  );
}
