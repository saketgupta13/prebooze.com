import { useEffect, useState } from 'react';
import { Medal } from 'lucide-react';
import { Kpi } from '../components/ui';
import { liveReferrals, LiveApiError, type LiveReferralAnalytics } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Refer & earn';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Refer & earn — program config (reward amounts, real PlatformSettings
 * fields) + platform-wide analytics (ReferralsAdminService.analytics), the
 * same real numbers ReferralsService.mine() derives from per-user. */
export default function Referrals() {
  const session = useLiveSession();
  const { token } = session;

  const [analytics, setAnalytics] = useState<LiveReferralAnalytics | null>(null);
  const [rates, setRates] = useState<{ referee: number; referrer: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveReferrals.analytics(), liveReferrals.rates()])
      .then(([a, r]) => {
        setAnalytics(a);
        setRates(r);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const updateRate = async (key: 'referee' | 'referrer', value: number) => {
    if (!rates) return;
    const next = { ...rates, [key]: value };
    setRates(next);
    try {
      await liveReferrals.updateRates({ [key]: value });
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    }
  };

  const RATES: { key: 'referee' | 'referrer'; label: string; hint: string }[] = [
    { key: 'referee', label: 'Friend (welcome credit)', hint: 'issued instantly on signup via a referral link' },
    { key: 'referrer', label: 'Referrer (reward)', hint: 'issued when the friend makes their first paid booking' },
  ];

  const top = analytics?.topReferrers ?? [];
  const maxJoined = Math.max(...top.map((t) => t.joined), 1);
  const referrals = analytics?.referrals ?? [];

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Refer &amp; earn</h1>
        <span className="small muted">two-sided wallet credits · rates apply across the guest app</span>
      </div>

      {analytics && (
        <div className="kpi-grid">
          <Kpi label="Friends referred" value={fmt(analytics.totalReferrals)} />
          <Kpi label="Qualified (booked)" value={fmt(analytics.qualified)} delta={`${analytics.conversion}% conversion`} deltaColor="var(--green)" />
          <Kpi label="Credits issued" value={`₹${fmt(analytics.creditsIssued)}`} delta="welcome + rewards" deltaColor="var(--muted)" />
          <Kpi label="Cost / qualified user" value={`₹${fmt(analytics.qualified ? Math.round(analytics.creditsIssued / analytics.qualified) : 0)}`} />
        </div>
      )}

      {/* Reward config */}
      {rates && (
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
                    value={String(rates[r.key])}
                    inputMode="numeric"
                    onChange={(e) => updateRate(r.key, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
                  />
                </div>
                <span className="tiny muted" style={{ marginTop: 4 }}>{r.hint}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top referrers */}
      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Top referrers</div>
        <div className="stack" style={{ gap: 8 }}>
          {top.map((t, i) => (
            <div key={t.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <b style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {i === 0 ? <Medal size={14} style={{ color: '#d4af37' }} /> : i === 1 ? <Medal size={14} style={{ color: '#a8a8a8' }} /> : i === 2 ? <Medal size={14} style={{ color: '#c07a3d' }} /> : `#${i + 1}`} {t.name}
                </b>
                <span className="muted">{t.joined} referred · {t.qualified} booked · ₹{fmt(t.qualified * (rates?.referrer ?? 0))} earned</span>
              </div>
              <div style={{ height: 8, background: 'rgba(139,195,74,.12)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                <div style={{ width: `${(t.joined / maxJoined) * 100}%`, height: '100%', background: 'var(--green)', opacity: 0.5 + (t.joined / maxJoined) * 0.5 }} />
              </div>
            </div>
          ))}
          {top.length === 0 && !loading && <div className="muted small">No referrals yet.</div>}
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
        {referrals.map((r) => (
          <div key={r.code} className="trow" style={{ minWidth: 620 }}>
            <span style={{ flex: 1.3 }}>
              <b>{r.referrer}</b>
              <span className="tiny muted" style={{ display: 'block' }}>{r.referrerPhone}</span>
            </span>
            <span style={{ flex: 1.3 }}>
              {r.referee}
              <span className="tiny muted" style={{ display: 'block' }}>{r.refereePhone}</span>
            </span>
            <span style={{ flex: 0.8 }} className="muted">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
            <span style={{ flex: 1 }}>
              {r.status === 'qualified' ? <span className="tag tag-green">qualified ✓</span> : <span className="tag" style={{ borderColor: 'var(--border)' }}>joined</span>}
            </span>
            <span style={{ flex: 1 }} className="muted">
              ₹{fmt((rates?.referee ?? 0) + (r.status === 'qualified' ? (rates?.referrer ?? 0) : 0))}
            </span>
          </div>
        ))}
        {referrals.length === 0 && !loading && <div className="trow muted">No referrals yet.</div>}
      </div>
      <div className="tiny hint">
        welcome credit issues on signup · referrer reward only after the friend's first paid booking · self-referrals and duplicate phones are blocked in the app
      </div>
    </div>
  );
}
