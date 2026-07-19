import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { GradientPhoto, ORGANIZER_STATUS, SearchBox, Tag } from '../components/ui';
import type { Promoter } from '../types';

const earned = (p: Promoter) => (p.perHeadEarned ?? 0) + (p.commissionEarned ?? 0);

/** Promoter / PR management — mirrors Organizers: approve KYC, view, suspend. */
export function Promoters() {
  const { promoters, subTiers, setPromoterStatus2 } = useAdmin();
  const navigate = useNavigate();
  const [cityF, setCityF] = useState('All');
  const [query, setQuery] = useState('');
  const cities = ['All', ...new Set(promoters.map((p) => p.city))];
  const pending = promoters.filter((p) => p.status === 'pending').length;
  const planName = (id: string) => subTiers.find((t) => t.id === id)?.name ?? id;

  const top = useMemo(
    () => [...promoters].filter((p) => earned(p) > 0).sort((a, b) => earned(b) - earned(a)).slice(0, 5),
    [promoters]
  );

  const list = useMemo(() => {
    let l = promoters;
    if (cityF !== 'All') l = l.filter((p) => p.city === cityF);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((p) => (p.name + p.contact).toLowerCase().includes(q));
    }
    return l;
  }, [promoters, cityF, query]);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="page-title">Promoters</h1>
          {pending > 0 && (
            <span className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 700 }}>
              {pending} awaiting review
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/promoters/tiers" className="btn btn-ghost btn-sm">Subscription tiers</Link>
          <Link to="/promoters/new" className="btn btn-pri btn-sm">+ Add promoter</Link>
        </div>
      </div>

      {top.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="display" style={{ fontWeight: 700 }}>🏆 Top promoters</span>
            <span className="tiny muted">by total earned</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {top.map((p, i) => {
              const maxE = earned(top[0]);
              const e = earned(p);
              return (
                <div key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/promoters/${p.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <b>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {p.name}</b>
                    <span className="muted">₹{fmt(e)} · {p.showRate}% show · {fmt(p.guestsBrought ?? 0)} guests</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(139,195,74,.12)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                    <div style={{ width: `${(e / maxE) * 100}%`, height: '100%', background: 'var(--green)', opacity: 0.5 + (e / maxE) * 0.5 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search promoters…" style={{ flex: 1, minWidth: 180 }} />
        {cities.map((c) => (
          <button key={c} className={`chip ${cityF === c ? 'on' : ''}`} onClick={() => setCityF(c)}>{c}</button>
        ))}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 860 }}>
          <span style={{ flex: 1.6 }}>Promoter</span>
          <span style={{ flex: 1 }}>City</span>
          <span style={{ flex: 0.9 }}>Plan</span>
          <span style={{ flex: 1 }}>Guests / mo</span>
          <span style={{ flex: 0.9 }}>Show-rate</span>
          <span style={{ flex: 1 }}>Earned</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1.4 }} />
        </div>
        {list.map((p) => (
          <div
            key={p.id}
            className="trow clickable"
            style={{ minWidth: 860, background: p.status === 'pending' ? 'rgba(255,107,94,.06)' : undefined }}
            onClick={() => navigate(`/promoters/${p.id}`)}
          >
            <span style={{ flex: 1.6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GradientPhoto seed={p.name.charCodeAt(0) * 6} style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', padding: 0 }} />
              {p.name}
            </span>
            <span style={{ flex: 1 }} className="muted">{p.city}</span>
            <span style={{ flex: 0.9 }}>{planName(p.plan)}</span>
            <span style={{ flex: 1 }}>{p.guestsThisMonth}</span>
            <span style={{ flex: 0.9 }} className={p.showRate >= 70 ? 'green' : p.showRate > 0 ? '' : 'hint'}>
              {p.showRate ? `${p.showRate}%` : '—'}
            </span>
            <span style={{ flex: 1 }} className={earned(p) > 0 ? '' : 'hint'}>{earned(p) > 0 ? `₹${fmt(earned(p))}` : '—'}</span>
            <span style={{ flex: 1 }}><Tag {...ORGANIZER_STATUS[p.status]} /></span>
            <span style={{ flex: 1.4, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {p.status === 'pending' && (
                <>
                  <button className="btn btn-pri btn-sm" onClick={(e) => { e.stopPropagation(); setPromoterStatus2(p.id, 'approved'); }}>Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); setPromoterStatus2(p.id, 'rejected'); }}>Reject</button>
                </>
              )}
            </span>
          </div>
        ))}
        {list.length === 0 && <div className="trow muted">No promoters match.</div>}
      </div>
      <div className="tiny hint">
        approving unlocks promoting for that PR · organizers still choose which promoters to allow per event · click a row for detail
      </div>
    </div>
  );
}

export function PromoterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { promoters, subTiers, setPromoterStatus2, removePromoter2, toast } = useAdmin();
  const p = promoters.find((x) => x.id === id);

  if (!p) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Promoter not found</h1>
        <Link to="/promoters" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Promoters</Link>
      </div>
    );
  }
  const planName = subTiers.find((t) => t.id === p.plan)?.name ?? p.plan;

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/promoters" style={{ fontSize: 13 }}>← Promoters</Link>
        <GradientPhoto seed={p.name.charCodeAt(0) * 6} style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none', padding: 0 }} />
        <h1 className="display" style={{ fontSize: 18 }}>{p.name}</h1>
        <Tag {...ORGANIZER_STATUS[p.status]} />
        <div style={{ flex: 1 }} />
        {p.status === 'pending' && (
          <>
            <button className="btn btn-pri btn-sm" onClick={() => setPromoterStatus2(p.id, 'approved')}>Approve ✓</button>
            <button className="btn btn-danger btn-sm" onClick={() => setPromoterStatus2(p.id, 'rejected')}>Reject</button>
          </>
        )}
        {p.status === 'approved' && (
          <button className="btn btn-danger btn-sm" onClick={() => setPromoterStatus2(p.id, 'rejected')}>Suspend</button>
        )}
        <Link to={`/promoters/${p.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
        <button className="btn btn-ghost btn-sm" onClick={() => toast('Message sent to promoter ✓')}>Message</button>
      </div>
      <div className="small muted">{p.contact} · {p.city} · {p.bio ?? ''}</div>

      <div className="kpi-grid">
        <div className="kpi"><div className="l">Plan</div><div className="v">{planName}</div></div>
        <div className="kpi"><div className="l">Guests this month</div><div className="v">{fmt(p.guestsThisMonth)}</div></div>
        <div className="kpi"><div className="l">Events promoted</div><div className="v">{p.eventsPromoted}</div></div>
        <div className="kpi"><div className="l">Show-up rate</div><div className="v">{p.showRate ? `${p.showRate}%` : '—'}</div></div>
      </div>

      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>KYC &amp; verification</div>
        <div className="kv"><span className="k">Identity KYC</span><span className={p.kyc === 'verified' ? 'green' : p.kyc === 'flagged' ? 'red' : 'muted'}>{p.kyc}</span></div>
        <div className="kv"><span className="k">Account status</span><span>{ORGANIZER_STATUS[p.status].label}</span></div>
        <div className="kv"><span className="k">Subscription</span><span>{planName}</span></div>
      </div>

      {(() => {
        const totalEarned = (p.perHeadEarned ?? 0) + (p.commissionEarned ?? 0);
        const avail = Math.max(0, totalEarned - (p.withdrawn ?? 0));
        const payouts = p.payouts ?? [];
        return (
          <>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="display" style={{ fontWeight: 700 }}>Earnings</span>
                <span className="tag" style={{ borderColor: 'var(--border)' }}>organizer-funded</span>
              </div>
              <div className="kpi-grid">
                <div className="kpi"><div className="l">Guests brought (lifetime)</div><div className="v">{fmt(p.guestsBrought ?? 0)}</div></div>
                <div className="kpi"><div className="l">Per-head payouts</div><div className="v">₹{fmt(p.perHeadEarned ?? 0)}</div></div>
                <div className="kpi"><div className="l">Gate commission</div><div className="v">₹{fmt(p.commissionEarned ?? 0)}</div></div>
                <div className="kpi"><div className="l">Total earned</div><div className="v green">₹{fmt(totalEarned)}</div></div>
              </div>
              <div className="kv" style={{ marginTop: 8 }}><span className="k">Paid out by organizers</span><span>₹{fmt(p.withdrawn ?? 0)}</span></div>
              <div className="kv"><span className="k">Outstanding (owed by organizers)</span><span className="green" style={{ fontWeight: 700 }}>₹{fmt(avail)}</span></div>
              <div className="tiny hint" style={{ marginTop: 6 }}>Prebooze doesn’t fund promoter payouts — organizers pay their promoters directly. This is admin visibility only.</div>
            </div>

            <div className="card">
              <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>Payout activity <span className="tiny muted" style={{ fontWeight: 400 }}>(read-only)</span></div>
              {payouts.length === 0 ? (
                <div className="muted small">No payouts yet.</div>
              ) : (
                <div className="tblwrap" style={{ border: 'none' }}>
                  <div className="thead" style={{ minWidth: 300 }}>
                    <span style={{ flex: 1 }}>Date</span>
                    <span style={{ flex: 1 }}>Amount</span>
                    <span style={{ flex: 1 }}>Status</span>
                  </div>
                  {payouts.map((w) => (
                    <div key={w.id} className="trow" style={{ minWidth: 300 }}>
                      <span style={{ flex: 1 }} className="muted">{w.date}</span>
                      <span style={{ flex: 1, fontWeight: 700 }}>₹{fmt(w.amount)}</span>
                      <span style={{ flex: 1 }} className={w.status === 'paid' ? 'green' : 'muted'}>{w.status === 'paid' ? 'paid by organizer' : 'processing'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="tiny hint" style={{ marginTop: 6 }}>per-head settles on verified arrivals · gate commission when a listed guest arrives late and buys a ticket · all settled by the organizer</div>
            </div>

            <button
              className="btn btn-danger btn-sm"
              style={{ width: 'fit-content' }}
              onClick={() => {
                if (window.confirm(`Remove ${p.name} entirely?`)) {
                  removePromoter2(p.id);
                  navigate('/promoters');
                }
              }}
            >
              ✕ Remove promoter
            </button>
          </>
        );
      })()}
    </div>
  );
}

export function PromoterTiers() {
  const { subTiers, updateSubTier } = useAdmin();
  return (
    <div className="stack fade" style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/promoters" style={{ fontSize: 13 }}>← Promoters</Link>
        <h1 className="page-title">Subscription tiers</h1>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>edit the plans promoters can buy — changes apply to the promoter app’s subscription page</div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 480 }}>
          <span style={{ flex: 1.4 }}>Tier</span>
          <span style={{ flex: 1 }}>Price ₹ / mo</span>
          <span style={{ flex: 1.2 }}>Guests / month</span>
        </div>
        {subTiers.map((t) => (
          <div key={t.id} className="trow" style={{ minWidth: 480 }}>
            <span style={{ flex: 1.4 }}>
              <input className="input" style={{ padding: '5px 8px' }} value={t.name} onChange={(e) => updateSubTier(t.id, { name: e.target.value })} />
            </span>
            <span style={{ flex: 1 }}>
              <input
                className="input"
                style={{ padding: '5px 8px' }}
                value={String(t.price)}
                inputMode="numeric"
                onChange={(e) => updateSubTier(t.id, { price: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
              />
            </span>
            <span style={{ flex: 1.2, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="input"
                style={{ padding: '5px 8px', width: 90 }}
                value={t.guests < 0 ? '' : String(t.guests)}
                inputMode="numeric"
                placeholder={t.guests < 0 ? '∞' : ''}
                onChange={(e) => updateSubTier(t.id, { guests: e.target.value === '' ? -1 : parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
              />
              <button className="chip" onClick={() => updateSubTier(t.id, { guests: t.guests < 0 ? 100 : -1 })}>
                {t.guests < 0 ? 'unlimited ✓' : 'set unlimited'}
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="tiny hint">guests / month is the list-add quota; blank or “unlimited” = no cap</div>
    </div>
  );
}
