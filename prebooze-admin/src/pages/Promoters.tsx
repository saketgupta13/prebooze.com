import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fmt, stripHtml } from '../store/data';
import { CityFilterDropdown, GradientPhoto, SearchBox, Tag } from '../components/ui';
import { livePromoters, LiveApiError, type LivePromoter } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Promoters';

/** Real promoter directory — already-approved Promoter catalog rows
 * (pending self-serve applications live in Verifications, not here — see
 * KycService.approve). Verified toggles the real ✓ badge; earnings/payout
 * dashboards from the mock have no admin-readable backing (no
 * PromoterWithdrawal admin endpoint exists yet), dropped rather than faked. */
export function Promoters() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [promoters, setPromoters] = useState<LivePromoter[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [cityF, setCityF] = useState('All');
  const [query, setQuery] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    livePromoters.list().then(setPromoters).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const cities = useMemo(() => [...new Set(promoters.map((p) => p.city).filter(Boolean))].sort(), [promoters]);

  const top = useMemo(
    () => [...promoters].filter((p) => p.guestsBrought > 0).sort((a, b) => b.guestsBrought - a.guestsBrought).slice(0, 5),
    [promoters],
  );

  const list = useMemo(() => {
    let l = promoters;
    if (cityF !== 'All') l = l.filter((p) => p.city === cityF);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((p) => (p.name + (p.contact ?? '')).toLowerCase().includes(q));
    }
    return l;
  }, [promoters, cityF, query]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const toggleVerified = async (p: LivePromoter, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await livePromoters.setVerified(p.id, !p.verified); load(); } catch (err2) { setErr(err2 instanceof LiveApiError ? err2.message : 'Failed to update'); }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Promoters</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/promoters/tiers" className="btn btn-ghost btn-sm">Subscription tiers</Link>
          <Link to="/promoters/new" className="btn btn-pri btn-sm">+ Add promoter</Link>
        </div>
      </div>

      {top.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="display" style={{ fontWeight: 700 }}>🏆 Top promoters</span>
            <span className="tiny muted">by guests brought</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {top.map((p, i) => {
              const maxG = top[0].guestsBrought || 1;
              return (
                <div key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/promoters/${p.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <b>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {p.name}</b>
                    <span className="muted">{p.showRate}% show · {fmt(p.guestsBrought)} guests</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(139,195,74,.12)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                    <div style={{ width: `${(p.guestsBrought / maxG) * 100}%`, height: '100%', background: 'var(--green)', opacity: 0.5 + (p.guestsBrought / maxG) * 0.5 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search promoters…" style={{ flex: 1, minWidth: 180 }} />
        <CityFilterDropdown value={cityF} onChange={setCityF} cities={cities} />
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 760 }}>
          <span style={{ flex: 1.6 }}>Promoter</span>
          <span style={{ flex: 1 }}>City</span>
          <span style={{ flex: 1 }}>Events promoted</span>
          <span style={{ flex: 0.9 }}>Show-rate</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1 }} />
        </div>
        {list.map((p) => (
          <div key={p.id} className="trow clickable" style={{ minWidth: 760 }} onClick={() => navigate(`/promoters/${p.id}`)}>
            <span style={{ flex: 1.6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GradientPhoto seed={p.name.charCodeAt(0) * 6} style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', padding: 0 }} />
              {p.name}
            </span>
            <span style={{ flex: 1 }} className="muted">{p.city}</span>
            <span style={{ flex: 1 }}>{p.eventsPromoted}</span>
            <span style={{ flex: 0.9 }} className={p.showRate >= 70 ? 'green' : p.showRate > 0 ? '' : 'hint'}>
              {p.showRate ? `${p.showRate}%` : '—'}
            </span>
            <span style={{ flex: 1 }}>
              {p.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Unverified" cls="" />}
            </span>
            <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={(e) => toggleVerified(p, e)}>
                {p.verified ? 'Unverify' : 'Verify'}
              </button>
            </span>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="trow muted">No promoters match.</div>}
      </div>
      <div className="tiny hint">
        pending promoter applications are reviewed under Verifications · organizers still choose which promoters to allow per event · click a row for detail
      </div>
    </div>
  );
}

export function PromoterDetail() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;

  const [promoters, setPromoters] = useState<LivePromoter[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    livePromoters.list().then(setPromoters).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate('Promoter detail', session);
  if (gate) return gate;

  const p = promoters.find((x) => x.id === id);

  if (!loading && !p) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Promoter not found</h1>
        <Link to="/promoters" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Promoters</Link>
      </div>
    );
  }
  if (!p) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const toggleVerified = async () => {
    try { await livePromoters.setVerified(p.id, !p.verified); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to update'); }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/promoters" style={{ fontSize: 13 }}>← Promoters</Link>
        <GradientPhoto seed={p.name.charCodeAt(0) * 6} style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none', padding: 0 }} />
        <h1 className="display" style={{ fontSize: 18 }}>{p.name}</h1>
        {p.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Unverified" cls="" />}
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={toggleVerified}>{p.verified ? 'Unverify' : 'Verify ✓'}</button>
        <Link to={`/promoters/${p.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
      </div>
      <div className="small muted">{p.contact || '—'} · {p.city} · {stripHtml(p.bio ?? '')}</div>

      <div className="kpi-grid">
        <div className="kpi"><div className="l">Events promoted</div><div className="v">{p.eventsPromoted}</div></div>
        <div className="kpi"><div className="l">Guests brought (lifetime)</div><div className="v">{fmt(p.guestsBrought)}</div></div>
        <div className="kpi"><div className="l">Show-up rate</div><div className="v">{p.showRate ? `${p.showRate}%` : '—'}</div></div>
        <div className="kpi"><div className="l">Followers</div><div className="v">{fmt(p.followers)}</div></div>
      </div>

      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>Account</div>
        <div className="kv"><span className="k">Verification</span><span className={p.verified ? 'green' : 'muted'}>{p.verified ? 'verified' : 'unverified'}</span></div>
        <div className="kv"><span className="k">Subscription plan</span><span>{p.planId}</span></div>
      </div>
    </div>
  );
}

export function PromoterTiers() {
  return (
    <div className="stack fade" style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/promoters" style={{ fontSize: 13 }}>← Promoters</Link>
        <h1 className="page-title">Subscription tiers</h1>
      </div>
      <div className="tiny hint">
        subscription plan pricing is managed under <Link to="/subscription-plans">Subscription plans</Link>, the same real plans a promoter subscribes to in their own app.
      </div>
    </div>
  );
}
