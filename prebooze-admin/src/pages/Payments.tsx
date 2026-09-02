import { useEffect, useState } from 'react';
import { Check, Landmark, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { livePayments, liveOrganizers, liveVenues, LiveApiError, type LivePayoutRow, type LivePaymentProfile, type LiveVenuePaymentProfile } from '../lib/liveApi';
import { PaymentProfileCard } from '../components/PaymentProfileFields';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Kpi } from '../components/ui';

const TITLE = 'Payments & payouts';
const TABS = ['Payouts due', 'Withdrawal requests', 'Transactions', 'Refunds', 'Disputes'];
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

interface OrganizerWithdrawal {
  id: string; organizerId: string; organizerName: string; amount: number; paidOut: boolean;
  bankLast4: string | null; accountHolderName: string | null; ifsc: string | null; createdAt: string;
}

/** Real per-event payout register (PaymentsService.due/markPaid) — "due"
 * only ever lists events that have actually finished, and marking one paid
 * requires the real UTR from a transfer you already made yourself; nothing
 * here moves money or invents a reference number. "Payouts due" is the only
 * tab with a real backend; the rest stay the same placeholder they always
 * were. */
export default function Payments() {
  const session = useLiveSession();
  const { token } = session;
  const [tab, setTab] = useState(TABS[0]);

  const [rows, setRows] = useState<LivePayoutRow[]>([]);
  const [summary, setSummary] = useState({ collected: 0, commissionKept: 0, dueTotal: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [utrDraft, setUtrDraft] = useState('');

  // Organizer self-serve ledger withdrawals — a separate money flow from
  // `rows`/`summary` above (per-event payouts due). Loaded alongside since
  // this page is the one place staff now check for both.
  const [withdrawals, setWithdrawals] = useState<OrganizerWithdrawal[]>([]);

  // Bank details expand inline, right in the row, instead of navigating to
  // the standalone Payment details page — staff evaluating a batch of
  // payouts here shouldn't have to leave the page to check an account
  // number. Keyed by "type:id" so switching between an organizer and a
  // venue row never collides, and a profile fetched once is cached rather
  // than re-fetched every time the same row is toggled open again.
  const [bankDetailsOpen, setBankDetailsOpen] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, (LivePaymentProfile | LiveVenuePaymentProfile)[]>>({});
  const [loadingProfile, setLoadingProfile] = useState<string | null>(null);

  const toggleBankDetails = async (payeeType: 'organizer' | 'venue', payeeId: string) => {
    const key = `${payeeType}:${payeeId}`;
    if (bankDetailsOpen === key) {
      setBankDetailsOpen(null);
      return;
    }
    setBankDetailsOpen(key);
    if (!profileCache[key]) {
      setLoadingProfile(key);
      try {
        const profiles = payeeType === 'organizer' ? await liveOrganizers.paymentProfiles(payeeId) : await liveVenues.paymentProfiles(payeeId);
        setProfileCache((prev) => ({ ...prev, [key]: profiles }));
      } catch (e) {
        setErr(e instanceof LiveApiError ? e.message : 'Failed to load bank details');
      } finally {
        setLoadingProfile(null);
      }
    }
  };

  const [markingWithdrawalId, setMarkingWithdrawalId] = useState<string | null>(null);
  const markWithdrawalPaid = async (id: string) => {
    setMarkingWithdrawalId(id);
    try {
      await livePayments.markOrganizerWithdrawalPaid(id);
      setWithdrawals((prev) => prev.map((w) => (w.id === id ? { ...w, paidOut: true } : w)));
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to mark paid');
    } finally {
      setMarkingWithdrawalId(null);
    }
  };

  const load = () => {
    setLoading(true);
    setErr('');
    livePayments
      .due()
      .then(({ rows: r, ...s }) => {
        setRows(r);
        setSummary(s);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
    livePayments.organizerWithdrawals().then(setWithdrawals).catch(() => {});
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const startPay = (id: string) => {
    setPayingId(id);
    setUtrDraft('');
    setErr('');
  };

  const confirmPay = async (id: string) => {
    if (!utrDraft.trim()) {
      setErr('Enter the UTR / reference number from the transfer you made');
      return;
    }
    setErr('');
    try {
      await livePayments.markPaid(id, utrDraft.trim());
      setPayingId(null);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to record payout');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Payments &amp; payouts</h1>
      </div>

      <div className="kpi-grid">
        <Kpi label="Collected" value={`₹${fmt(summary.collected)}`} />
        <Kpi label="Commission kept" value={`₹${fmt(summary.commissionKept)}`} />
        <Kpi label="Due total" value={<span className="red">₹{fmt(summary.dueTotal)}</span>} alert />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Payouts due' ? (
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 640 }}>
            <span style={{ flex: 1.6 }}>Organizer</span>
            <span style={{ flex: 1.6 }}>Event</span>
            <span style={{ flex: 1 }}>Gross</span>
            <span style={{ flex: 1.1 }}>Commission</span>
            <span style={{ flex: 1 }}>Net payout</span>
            <span style={{ flex: 0.9 }} />
          </div>
          {rows.length === 0 && !loading && <div className="trow muted">No payouts due — events only show up here once they've actually happened.</div>}
          {rows.map((r) => {
            const detailsKey = r.payeeType && r.payeeId ? `${r.payeeType}:${r.payeeId}` : null;
            const detailsOpen = detailsKey !== null && bankDetailsOpen === detailsKey;
            return (
            <div key={r.id} className="trow" style={{ minWidth: 640, flexWrap: payingId === r.id || detailsOpen ? 'wrap' : undefined }}>
              <span style={{ flex: 1.6, fontWeight: 700 }}>
                {r.payeeType && r.payeeId ? (
                  <button
                    type="button"
                    onClick={() => toggleBankDetails(r.payeeType!, r.payeeId!)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--green)', font: 'inherit', fontWeight: 700 }}
                    title="Show bank details"
                  >
                    {r.organizer} <Landmark size={12} style={{ opacity: 0.6 }} /> {detailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                ) : (
                  r.organizer
                )}
              </span>
              <span style={{ flex: 1.6 }} className="muted">{r.title}</span>
              <span style={{ flex: 1 }}>₹{fmt(r.revenue)}</span>
              <span style={{ flex: 1.1 }}>
                ₹{fmt(r.commissionAmt)} <span className="muted">({r.commission ?? 0}%)</span>
              </span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">
                ₹{fmt(r.net)}
                {r.paidOut && r.payoutUtr && <span className="tiny muted" style={{ display: 'block', fontWeight: 400 }}>{r.payoutUtr}</span>}
              </span>
              <span style={{ flex: 0.9, display: 'flex', justifyContent: 'flex-end' }}>
                {r.paidOut ? (
                  <span className="tag tag-green" title={r.payoutUtr ?? undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Paid <Check size={11} /></span>
                ) : payingId === r.id ? null : (
                  <button className="btn btn-ghost btn-sm" onClick={() => startPay(r.id)}>
                    Mark paid…
                  </button>
                )}
              </span>
              {detailsOpen && (
                <div style={{ flex: '1 0 100%', marginTop: 8 }}>
                  {loadingProfile === detailsKey && <div className="tiny muted">Loading bank details…</div>}
                  {loadingProfile !== detailsKey && (profileCache[detailsKey!]?.length ?? 0) === 0 && (
                    <div className="tiny muted">No payment profile on file — {r.organizer} hasn't added one yet.</div>
                  )}
                  {profileCache[detailsKey!]?.map((p) => <PaymentProfileCard key={p.id} profile={p} />)}
                </div>
              )}
              {!r.paidOut && payingId === r.id && (
                <div style={{ flex: '1 0 100%', display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="Real UTR / transaction reference from the transfer you made"
                    value={utrDraft}
                    onChange={(e) => setUtrDraft(e.target.value)}
                    autoFocus
                  />
                  <button className="btn btn-pri btn-sm" onClick={() => confirmPay(r.id)}>Confirm</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPayingId(null)}>Cancel</button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      ) : tab === 'Withdrawal requests' ? (
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 700 }}>
            <span style={{ flex: 1.4 }}>Organizer</span>
            <span style={{ flex: 1 }}>Amount</span>
            <span style={{ flex: 1.4 }}>Bank</span>
            <span style={{ flex: 1 }}>Date</span>
            <span style={{ flex: 1 }} />
          </div>
          {withdrawals.length === 0 && !loading && <div className="trow muted">No withdrawal requests yet.</div>}
          {withdrawals.map((w) => {
            const detailsKey = `organizer:${w.organizerId}`;
            const detailsOpen = bankDetailsOpen === detailsKey;
            return (
            <div key={w.id} className="trow" style={{ minWidth: 700, flexWrap: detailsOpen ? 'wrap' : undefined }}>
              <span style={{ flex: 1.4, fontWeight: 700 }}>
                <button
                  type="button"
                  onClick={() => toggleBankDetails('organizer', w.organizerId)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--green)', font: 'inherit', fontWeight: 700 }}
                  title="Show bank details"
                >
                  {w.organizerName} <Landmark size={12} style={{ opacity: 0.6 }} /> {detailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(w.amount)}</span>
              <span style={{ flex: 1.4 }} className="muted small">
                {w.accountHolderName ? `${w.accountHolderName} · ` : ''}{w.bankLast4 ? `•••• ${w.bankLast4}` : '—'}{w.ifsc ? ` · ${w.ifsc}` : ''}
              </span>
              <span style={{ flex: 1 }} className="tiny muted">{new Date(w.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                {w.paidOut ? (
                  <span className="tag tag-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Paid <Check size={11} /></span>
                ) : (
                  <button className="btn btn-pri btn-sm" disabled={markingWithdrawalId === w.id} onClick={() => markWithdrawalPaid(w.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {markingWithdrawalId === w.id ? 'Marking…' : <><CheckCircle2 size={12} /> Mark paid</>}
                  </button>
                )}
              </span>
              {detailsOpen && (
                <div style={{ flex: '1 0 100%', marginTop: 8 }}>
                  {loadingProfile === detailsKey && <div className="tiny muted">Loading bank details…</div>}
                  {loadingProfile !== detailsKey && (profileCache[detailsKey]?.length ?? 0) === 0 && (
                    <div className="tiny muted">No payment profile on file — {w.organizerName} hasn't added one yet.</div>
                  )}
                  {profileCache[detailsKey]?.map((p) => <PaymentProfileCard key={p.id} profile={p} />)}
                </div>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <div className="ph" style={{ height: 120, borderRadius: 10 }}>{tab} — coming with backend integration</div>
      )}
      <div className="tiny hint">
        commission % per row comes from each event's own rate — set in the event editor.
      </div>
    </div>
  );
}
