import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check } from 'lucide-react';
import {
  livePayments, liveOrganizers, liveVenues, LiveApiError,
  type LivePayeeDetail, type LivePaymentProfile, type LiveVenuePaymentProfile, type PayoutPipelineStatus,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Tag } from '../components/ui';
import { PaymentProfileCard } from '../components/PaymentProfileFields';

const TITLE = 'Payout details';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const PIPELINE: { key: PayoutPipelineStatus; label: string }[] = [
  { key: 'requested', label: 'Requested' },
  { key: 'received', label: 'Received' },
  { key: 'initiated', label: 'Initiated' },
  { key: 'processed', label: 'Processed' },
  { key: 'complete', label: 'Complete' },
];
const STATUS_CLS: Record<PayoutPipelineStatus, string> = {
  requested: 'tag-dim', received: 'tag-amber', initiated: 'tag-amber', processed: 'tag-amber', complete: 'tag-green', rejected: 'tag-red',
};

/** One payee (organizer or venue), everything in one screen (2026-09-18) —
 * bank details, every event's own commission breakdown (real historical
 * record, not just what's currently due), and the full self-serve
 * withdrawal history with its real status timeline. Reached by clicking a
 * payee's name anywhere in Payments.tsx instead of that page trying to show
 * per-event rows for every payee at once. */
export default function PayoutDetail() {
  const session = useLiveSession();
  const { token } = session;
  const { payeeType, payeeId } = useParams<{ payeeType: 'organizer' | 'venue'; payeeId: string }>();

  const [detail, setDetail] = useState<LivePayeeDetail | null>(null);
  const [profiles, setProfiles] = useState<(LivePaymentProfile | LiveVenuePaymentProfile)[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [payingEventId, setPayingEventId] = useState<string | null>(null);
  const [utrDraft, setUtrDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const [advancing, setAdvancing] = useState<string | null>(null); // withdrawal id currently showing an action form
  const [advanceUtr, setAdvanceUtr] = useState('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    if (!payeeType || !payeeId) return;
    setLoading(true);
    setErr('');
    Promise.all([
      livePayments.payeeDetail(payeeType, payeeId),
      payeeType === 'organizer' ? liveOrganizers.paymentProfiles(payeeId) : liveVenues.paymentProfiles(payeeId),
    ])
      .then(([d, p]) => { setDetail(d); setProfiles(p); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, payeeType, payeeId]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const confirmEventPay = async (eventId: string) => {
    if (!utrDraft.trim()) { setErr('Enter the UTR / reference number from the transfer you made'); return; }
    setErr(''); setBusy(true);
    try {
      await livePayments.markPaid(eventId, utrDraft.trim());
      setPayingEventId(null);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to record payout');
    } finally { setBusy(false); }
  };

  const advance = async (withdrawalId: string, status: PayoutPipelineStatus) => {
    if (!payeeType) return;
    if (status === 'complete' && !advanceUtr.trim()) { setErr('Enter the real UTR / transaction reference for this transfer'); return; }
    setErr(''); setBusy(true);
    try {
      await livePayments.advanceWithdrawal(payeeType, withdrawalId, { status, utr: status === 'complete' ? advanceUtr.trim() : undefined });
      setAdvancing(null); setAdvanceUtr('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update status');
    } finally { setBusy(false); }
  };

  const reject = async (withdrawalId: string) => {
    if (!payeeType) return;
    if (!rejectReason.trim()) { setErr('Enter a reason so the payee knows what happened'); return; }
    setErr(''); setBusy(true);
    try {
      await livePayments.advanceWithdrawal(payeeType, withdrawalId, { status: 'rejected', reason: rejectReason.trim() });
      setRejecting(null); setRejectReason('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reject');
    } finally { setBusy(false); }
  };

  if (loading && !detail) return <div className="stack fade" style={{ maxWidth: 1000 }}><LiveHeaderBar title={TITLE} session={session} /><div className="tiny muted">Loading…</div></div>;
  if (!detail) return <div className="stack fade" style={{ maxWidth: 1000 }}><LiveHeaderBar title={TITLE} session={session} />{err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}</div>;

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <Link to="/payments" className="tiny link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Back to Payments</Link>

      <div className="page-hd" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{detail.payeeName}</h1>
        <Tag label={detail.payeeType === 'organizer' ? 'Organizer' : 'Venue'} cls="tag-dim" />
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="l">Current balance</div><div className="v">₹{fmt(detail.balance)}</div></div>
        <div className="kpi"><div className="l">Due now</div><div className="v" style={{ color: detail.dueTotal > 0 ? 'var(--red)' : undefined }}>₹{fmt(detail.dueTotal)}</div></div>
      </div>

      {detail.hasOpenWithdrawal && (
        <div className="card" style={{ borderColor: 'var(--amber, #d99a2b)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span className="small">This payee has an open self-serve withdrawal request below — resolve that first before marking any event paid, so the same money isn't paid out twice.</span>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Bank details</h3>
        {profiles.length === 0 && <div className="tiny muted">No payment profile on file — {detail.payeeName} hasn't added one yet.</div>}
        <div className="stack" style={{ gap: 8 }}>
          {profiles.map((p) => <PaymentProfileCard key={p.id} profile={p} />)}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Events — commission breakdown</h3>
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 560 }}>
            <span style={{ flex: 1.8 }}>Event</span>
            <span style={{ flex: 1 }}>Gross</span>
            <span style={{ flex: 1.1 }}>Commission</span>
            <span style={{ flex: 1 }}>Net payout</span>
            <span style={{ flex: 0.9 }} />
          </div>
          {detail.events.length === 0 && <div className="trow muted">No completed events yet.</div>}
          {detail.events.map((r) => (
            <div key={r.id} className="trow" style={{ minWidth: 560, flexWrap: payingEventId === r.id ? 'wrap' : undefined }}>
              <span style={{ flex: 1.8 }} className="muted">{r.title}</span>
              <span style={{ flex: 1 }}>₹{fmt(r.revenue)}</span>
              <span style={{ flex: 1.1 }}>₹{fmt(r.commissionAmt)} <span className="muted">({r.commission ?? 0}%)</span></span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">
                ₹{fmt(r.net)}
                {r.paidOut && r.payoutUtr && <span className="tiny muted" style={{ display: 'block', fontWeight: 400 }}>{r.payoutUtr}</span>}
                {!r.paidOut && r.payeeBalance !== null && r.payeeBalance < r.net && (
                  <span className="tiny" style={{ display: 'block', fontWeight: 400, color: 'var(--red)' }}>already withdrawn — only ₹{fmt(r.payeeBalance)} left</span>
                )}
              </span>
              <span style={{ flex: 0.9, display: 'flex', justifyContent: 'flex-end' }}>
                {r.paidOut ? (
                  <span className="tag tag-green" title={r.payoutUtr ?? undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Paid <Check size={11} /></span>
                ) : payingEventId === r.id ? null : (
                  <button className="btn btn-ghost btn-sm" disabled={r.payeeBalance === 0 || detail.hasOpenWithdrawal} onClick={() => { setPayingEventId(r.id); setUtrDraft(''); setErr(''); }}>
                    Mark paid…
                  </button>
                )}
              </span>
              {!r.paidOut && payingEventId === r.id && (
                <div style={{ flex: '1 0 100%', display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input className="input" style={{ flex: 1 }} placeholder="Real UTR / transaction reference" value={utrDraft} onChange={(e) => setUtrDraft(e.target.value)} autoFocus />
                  <button className="btn btn-pri btn-sm" disabled={busy} onClick={() => confirmEventPay(r.id)}>{busy ? 'Saving…' : 'Confirm'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPayingEventId(null)}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Payout tracking</h3>
        <p className="tiny muted" style={{ marginBottom: 12 }}>Every self-serve withdrawal this payee has requested, with the real stage it's actually at — this is exactly what they see on their own side too.</p>
        {detail.withdrawals.length === 0 && <div className="tiny muted">No withdrawal requests yet.</div>}
        <div className="stack" style={{ gap: 14 }}>
          {detail.withdrawals.map((w) => {
            const isOpen = w.status !== 'complete' && w.status !== 'rejected';
            const currentIdx = PIPELINE.findIndex((s) => s.key === w.status);
            return (
              <div key={w.id} className="card" style={{ background: 'rgba(139,195,74,.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div>
                    <span className="bold">₹{fmt(w.amount)}</span>{' '}
                    <span className="tiny muted">requested {fmtDate(w.createdAt)}</span>
                  </div>
                  <Tag label={w.status === 'rejected' ? 'Rejected' : PIPELINE.find((s) => s.key === w.status)?.label ?? w.status} cls={STATUS_CLS[w.status]} />
                </div>

                {w.status !== 'rejected' && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    {PIPELINE.map((s, i) => (
                      <div key={s.key} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ height: 4, borderRadius: 2, background: i <= currentIdx ? 'var(--green)' : 'rgba(139,195,74,.15)', marginBottom: 4 }} />
                        <span className="tiny" style={{ opacity: i <= currentIdx ? 1 : 0.5 }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {w.status === 'rejected' && w.rejectedReason && (
                  <div className="tiny" style={{ color: 'var(--red)', marginBottom: 10 }}>Rejected: {w.rejectedReason}</div>
                )}
                {w.status === 'complete' && w.utr && (
                  <div className="tiny muted" style={{ marginBottom: 10 }}>UTR: {w.utr}</div>
                )}

                <details style={{ marginBottom: isOpen ? 10 : 0 }}>
                  <summary className="tiny muted" style={{ cursor: 'pointer' }}>History ({w.statusEvents.length})</summary>
                  <div className="stack" style={{ gap: 4, marginTop: 6 }}>
                    {w.statusEvents.map((e) => (
                      <div key={e.id} className="tiny muted">
                        {fmtDateTime(e.createdAt)} — {e.status}
                        {e.reason ? ` (${e.reason})` : ''}{e.utr ? ` · ${e.utr}` : ''}{e.staffEmail ? ` · ${e.staffEmail}` : ' · self-reported'}
                      </div>
                    ))}
                  </div>
                </details>

                {isOpen && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {currentIdx < PIPELINE.length - 2 && (
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => advance(w.id, PIPELINE[currentIdx + 1].key)}>
                        Mark {PIPELINE[currentIdx + 1].label.toLowerCase()}
                      </button>
                    )}
                    {advancing !== w.id && rejecting !== w.id && (
                      <>
                        <button className="btn btn-pri btn-sm" onClick={() => { setAdvancing(w.id); setAdvanceUtr(''); setErr(''); }}>Mark complete…</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => { setRejecting(w.id); setRejectReason(''); setErr(''); }}>Reject…</button>
                      </>
                    )}
                    {advancing === w.id && (
                      <div style={{ display: 'flex', gap: 8, flex: '1 0 100%', marginTop: 4 }}>
                        <input className="input" style={{ flex: 1 }} placeholder="Real UTR / transaction reference from the transfer you made" value={advanceUtr} onChange={(e) => setAdvanceUtr(e.target.value)} autoFocus />
                        <button className="btn btn-pri btn-sm" disabled={busy} onClick={() => advance(w.id, 'complete')}>{busy ? 'Saving…' : 'Confirm complete'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setAdvancing(null)}>Cancel</button>
                      </div>
                    )}
                    {rejecting === w.id && (
                      <div style={{ display: 'flex', gap: 8, flex: '1 0 100%', marginTop: 4 }}>
                        <input className="input" style={{ flex: 1 }} placeholder="Reason the payee will see (e.g. bank details don't match, duplicate request)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} autoFocus />
                        <button className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff' }} disabled={busy} onClick={() => reject(w.id)}>{busy ? 'Saving…' : 'Confirm reject'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setRejecting(null)}>Cancel</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
