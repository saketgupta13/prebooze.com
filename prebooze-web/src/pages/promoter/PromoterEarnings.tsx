import { useEffect, useState, type ReactNode } from 'react';
import { fmtMoney } from '../../data/mock';
import { promoter as promoterApi, type PromoterWithdrawal } from '../../api';
import { ApiError } from '../../api/client';
import Loader from '../../components/Loader';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Percent } from 'lucide-react';

const MIN_WITHDRAW = 500;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface EventEarning {
  eventId: string;
  title: string;
  date: string;
  organizerId: string;
  organizerName: string;
  perHead: number;
  perHeadRate: number;
  perHeadCount: number;
  commission: number;
  total: number;
  status: 'pending' | 'reminder_sent' | 'received';
}

const STATUS_LABEL: Record<EventEarning['status'], ReactNode> = {
  pending: 'Not marked paid yet',
  reminder_sent: 'Reminder sent to organizer',
  received: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Received</span>,
};

/** What a promoter has earned — per-head payouts on verified arrivals + a
 * revenue-share % (individually negotiated with the organizer per event,
 * per promoter — not a platform-wide flat rate) on paid tickets sold
 * through their link — and can withdraw. GET /promoter/earnings computes
 * both live off PromoterGuest/Booking.promoterCommission (the commission
 * side is locked in at sale time, so it never drifts from what was
 * actually promised on a past sale — see BookingsService.promoterCommissionFor).
 * Real money still moves entirely outside Prebooze (no split-payment rail
 * exists), so the per-event section below is a self-attested "did the
 * organizer actually pay me" tracker, not a payment record. */
export default function PromoterEarnings() {
  const [earnings, setEarnings] = useState({ perHead: 0, commission: 0, withdrawn: 0 });
  // Prebooze's OWN promoter-referral commission (2026-09-02) — completely
  // separate money, source, and payer from `earnings` above (organizer-
  // funded). Fetched and rendered independently so the two never get
  // visually merged into one misleading "total".
  const [platformEarnings, setPlatformEarnings] = useState({ total: 0, paidOut: 0, pending: 0 });
  const [byEvent, setByEvent] = useState<EventEarning[]>([]);
  const [withdrawals, setWithdrawals] = useState<PromoterWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [msg, setMsg] = useState<ReactNode>('');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');

  const load = () => {
    setLoading(true);
    Promise.all([promoterApi.earnings(), promoterApi.withdrawals(), promoterApi.eventEarnings(), promoterApi.platformEarnings()])
      .then(([e, w, ev, pe]) => { setEarnings(e); setWithdrawals(w); setByEvent(ev); setPlatformEarnings(pe); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load earnings'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const markReceived = async (eventId: string) => {
    setActingOn(eventId);
    setErr('');
    try {
      await promoterApi.markEventReceived(eventId);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update');
    } finally {
      setActingOn(null);
    }
  };

  const remindOrganizer = async (eventId: string) => {
    setActingOn(eventId);
    setErr('');
    try {
      await promoterApi.remindOrganizerToPay(eventId);
      setMsg(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Reminder sent</span>);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to send reminder');
    } finally {
      setActingOn(null);
    }
  };

  if (loading) return <Loader />;

  const grossEarned = earnings.perHead + earnings.commission;
  const available = Math.max(0, grossEarned - earnings.withdrawn);

  const organizerOptions = Array.from(new Map(byEvent.map((e) => [e.organizerId, e.organizerName])).entries());
  const eventOptions = byEvent.filter((e) => orgFilter === 'all' || e.organizerId === orgFilter);
  const filtered = byEvent.filter(
    (e) => (orgFilter === 'all' || e.organizerId === orgFilter) && (eventFilter === 'all' || e.eventId === eventFilter),
  );
  const filteredTotalsByOrg = Array.from(
    filtered.reduce((m, e) => m.set(e.organizerName, (m.get(e.organizerName) ?? 0) + e.total), new Map<string, number>()),
  );

  const requestPayout = async () => {
    if (available < MIN_WITHDRAW) {
      setMsg(`Minimum payout is ${fmtMoney(MIN_WITHDRAW)}`);
      return;
    }
    setErr('');
    setMsg('');
    setRequesting(true);
    try {
      await promoterApi.withdraw(available);
      setMsg(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Payout of {fmtMoney(available)} requested</span>);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Earnings</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        The <b>organizer</b> pays you directly (not Prebooze): a per-head payout on every guest who shows up, plus —
        on any event where they've offered it — a % of their revenue for tickets bought through your link. Both are
        set individually per event by the organizer.
      </p>

      {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="l">Per-head payouts</div>
          <div className="v">{fmtMoney(earnings.perHead)}</div>
        </div>
        <div className="kpi">
          <div className="l">Ticket commission</div>
          <div className="v">{fmtMoney(earnings.commission)}</div>
        </div>
        <div className="kpi">
          <div className="l">Total earned</div>
          <div className="v accent">{fmtMoney(grossEarned)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="tiny muted-2">Available to withdraw</div>
            <div style={{ fontSize: 26, fontWeight: 800 }} className="accent">{fmtMoney(available)}</div>
            <div className="tiny muted-2">{fmtMoney(earnings.withdrawn)} withdrawn to date · min payout {fmtMoney(MIN_WITHDRAW)}</div>
            {msg && <div className="tiny" style={{ marginTop: 4 }}>{msg}</div>}
          </div>
          <button className="btn btn-pri" disabled={available < MIN_WITHDRAW || requesting} onClick={requestPayout} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {requesting ? 'Requesting…' : <>Request payout <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="tiny muted-2" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Percent size={12} /> Prebooze commission</div>
            <div style={{ fontSize: 26, fontWeight: 800 }} className="accent">{fmtMoney(platformEarnings.total)}</div>
            <div className="tiny muted-2">
              {fmtMoney(platformEarnings.paidOut)} paid out · {fmtMoney(platformEarnings.pending)} pending — 2% of Prebooze's own cut on paid tickets sold through your city-events links, paid by Prebooze itself, not the organizer.
            </div>
          </div>
          <Link to="/promoter/city-events" className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Promote an event <ArrowRight size={14} /></Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <h3>Per-event breakdown</h3>
          {byEvent.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="chip"
                value={orgFilter}
                onChange={(e) => { setOrgFilter(e.target.value); setEventFilter('all'); }}
              >
                <option value="all">All organizers</option>
                {organizerOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <select className="chip" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
                <option value="all">All events</option>
                {eventOptions.map((e) => (
                  <option key={e.eventId} value={e.eventId}>{e.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {byEvent.length === 0 ? (
          <div className="muted small">No earnings on any event yet.</div>
        ) : filtered.length === 0 ? (
          <div className="muted small">No earnings match this filter.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orgFilter === 'all' && filteredTotalsByOrg.length > 1 && (
              <div className="tiny muted-2">
                {filteredTotalsByOrg.map(([name, total], i) => (
                  <span key={name}>
                    {i > 0 && ' · '}{name}: <b className="accent">{fmtMoney(total)}</b>
                  </span>
                ))}
              </div>
            )}
            {filtered.map((e) => (
              <div key={e.eventId} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="bold small">{e.title}</div>
                    <div className="tiny muted-2">{fmtDate(e.date)} · {e.organizerName}</div>
                    <div className="tiny muted-2" style={{ marginTop: 4 }}>
                      {e.perHead > 0 && (
                        <span>Guest list: ₹{e.perHeadRate} × {e.perHeadCount} arrival{e.perHeadCount === 1 ? '' : 's'} = {fmtMoney(e.perHead)}</span>
                      )}
                      {e.perHead > 0 && e.commission > 0 && ' · '}
                      {e.commission > 0 && <span>Revenue share {fmtMoney(e.commission)}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="bold" style={{ fontSize: 18 }}>{fmtMoney(e.total)}</div>
                    <div className="tiny" style={{ marginTop: 2, color: e.status === 'received' ? 'var(--green, #2a9d5c)' : 'var(--muted-2)' }}>
                      {STATUS_LABEL[e.status]}
                    </div>
                  </div>
                </div>
                {e.status !== 'received' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn btn-pri btn-sm" disabled={actingOn === e.eventId} onClick={() => markReceived(e.eventId)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={14} /> I got paid
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={actingOn === e.eventId} onClick={() => remindOrganizer(e.eventId)}>
                      {e.status === 'reminder_sent' ? 'Remind again' : 'Remind organizer'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {withdrawals.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Payout history</h3>
          {withdrawals.map((w) => (
            <div key={w.id} className="evrow">
              <span className="small" style={{ flex: 1 }}>{fmtDate(w.createdAt)}</span>
              <span className="bold small" style={{ flex: 1, textAlign: 'right' }}>{fmtMoney(w.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="tiny muted-2" style={{ marginTop: 14 }}>
        you're paid by the <b>organizer</b> running each event — Prebooze doesn't fund promoter payouts · per-head
        amounts and commission are set per event by the organizer
      </div>
    </div>
  );
}
