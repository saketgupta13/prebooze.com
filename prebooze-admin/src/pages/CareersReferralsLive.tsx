import { useEffect, useState } from 'react';
import { liveCareers, liveReferrals, LiveApiError, type LiveJob, type LiveApplicant, type LiveReferralAnalytics } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Careers & referrals (live)';
type Tab = 'jobs' | 'referrals';
const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function CareersReferralsLive() {
  const session = useLiveSession();
  const { token } = session;
  const [tab, setTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [applicants, setApplicants] = useState<LiveApplicant[]>([]);
  const [analytics, setAnalytics] = useState<LiveReferralAnalytics | null>(null);
  const [rates, setRates] = useState<{ referee: number; referrer: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [newLoc, setNewLoc] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveCareers.listJobs(), liveCareers.listApplicants(), liveReferrals.analytics(), liveReferrals.rates()])
      .then(([j, a, an, r]) => { setJobs(j); setApplicants(a); setAnalytics(an); setRates(r); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await liveCareers.createJob({ title: newTitle.trim(), team: newTeam.trim(), loc: newLoc.trim() });
      setNewTitle(''); setNewTeam(''); setNewLoc('');
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to create job');
    }
  };

  const toggleJob = async (id: string) => {
    try { await liveCareers.toggleJob(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to update'); }
  };
  const removeJob = async (id: string) => {
    if (!window.confirm('Remove this job posting?')) return;
    try { await liveCareers.removeJob(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const saveRates = async () => {
    if (!rates) return;
    try { setRates(await liveReferrals.updateRates(rates)); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to save'); }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        <button className={tab === 'jobs' ? 'on' : ''} onClick={() => setTab('jobs')}>Careers</button>
        <button className={tab === 'referrals' ? 'on' : ''} onClick={() => setTab('referrals')}>Refer &amp; earn</button>
      </div>

      {tab === 'jobs' && (
        <>
          <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={createJob}>
            <div className="field" style={{ flex: 1, minWidth: 160 }}><label>Title</label><input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></div>
            <div className="field" style={{ width: 140 }}><label>Team</label><input className="input" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} /></div>
            <div className="field" style={{ width: 140 }}><label>Location</label><input className="input" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} /></div>
            <button type="submit" className="btn btn-pri">+ Post job</button>
          </form>
          <div className="tblwrap">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', fontWeight: 700 }}>Job postings</div>
            {jobs.map((j) => (
              <div key={j.id} className="trow">
                <span style={{ flex: 1.6, fontWeight: 700 }}>{j.title}</span>
                <span style={{ flex: 1 }} className="tiny muted">{j.team} · {j.loc}</span>
                <span style={{ flex: 0.8 }}><button className="btn btn-ghost btn-sm" onClick={() => toggleJob(j.id)}><span className={`tag ${j.status === 'open' ? 'tag-green' : ''}`}>{j.status}</span></button></span>
                <span style={{ flex: 0.4, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => removeJob(j.id)}>✕</button></span>
              </div>
            ))}
          </div>
          <div className="tblwrap">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', fontWeight: 700 }}>Applicants ({applicants.length})</div>
            {applicants.length === 0 ? <div className="trow muted">No applicants yet.</div> : applicants.map((a) => (
              <div key={a.id} className="trow">
                <span style={{ flex: 1.4, fontWeight: 700 }}>{a.name}</span>
                <span style={{ flex: 1.4 }} className="tiny muted">{a.email} · {a.phone}</span>
                <span style={{ flex: 0.6 }} className="tiny muted">{new Date(a.appliedAt).toLocaleDateString('en-IN')}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'referrals' && analytics && rates && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="card" style={{ minWidth: 150, flex: 1 }}><div className="tiny muted">Total referrals</div><div style={{ fontSize: 20, fontWeight: 800 }}>{analytics.totalReferrals}</div></div>
            <div className="card" style={{ minWidth: 150, flex: 1 }}><div className="tiny muted">Conversion</div><div style={{ fontSize: 20, fontWeight: 800 }}>{analytics.conversion}%</div></div>
            <div className="card" style={{ minWidth: 150, flex: 1 }}><div className="tiny muted">Credits issued</div><div style={{ fontSize: 20, fontWeight: 800 }}>{fmtMoney(analytics.creditsIssued)}</div></div>
          </div>
          <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 140 }}>
              <label>Referee welcome ₹</label>
              <input className="input" inputMode="numeric" value={rates.referee} onChange={(e) => setRates({ ...rates, referee: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <div className="field" style={{ width: 140 }}>
              <label>Referrer reward ₹</label>
              <input className="input" inputMode="numeric" value={rates.referrer} onChange={(e) => setRates({ ...rates, referrer: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <button className="btn btn-pri" onClick={saveRates}>Save rates</button>
          </div>
          <div className="tblwrap">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', fontWeight: 700 }}>Top referrers</div>
            {analytics.topReferrers.length === 0 ? <div className="trow muted">No referrals yet.</div> : analytics.topReferrers.map((r, i) => (
              <div key={i} className="trow">
                <span style={{ flex: 1.6, fontWeight: 700 }}>{r.name}</span>
                <span style={{ flex: 1 }} className="muted">{r.joined} joined</span>
                <span style={{ flex: 1 }} className="muted">{r.qualified} qualified</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
