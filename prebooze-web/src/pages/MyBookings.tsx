import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import { bookings as bookingsApi } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Booking } from '../types';
import QRCode from '../components/QRCode';
import { downloadTicket } from '../lib/ticket';
import { downloadIcs } from '../lib/calendar';
import { eventLocation } from '../lib/venue';
import { cityBrowse } from '../lib/urls';
import type { ReactNode } from 'react';
import { Undo2, Hourglass, Calendar, MapPin, Ticket, CreditCard, CheckCircle2, Wallet, Download } from 'lucide-react';

const REFUND_BADGE: Record<string, { cls: string; label: ReactNode }> = {
  refunded: { cls: 'badge-accent', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Refunded <Undo2 size={12} /></span> },
  refund_requested: { cls: 'badge-accent', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Refund pending <Hourglass size={12} /></span> },
  cancelled: { cls: 'badge-danger', label: 'Cancelled' },
};

export default function MyBookings() {
  const { bookings, refundBooking, myEvents, refreshWallet, toast, city } = useApp();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [liveBookings, setLiveBookings] = useState<Booking[] | null>(null);
  const loading = isBackendEnabled() && liveBookings === null;
  const refetchLive = () => {
    if (!isBackendEnabled()) return;
    bookingsApi.list().then(setLiveBookings).catch(() => setLiveBookings([]));
  };
  useEffect(refetchLive, []);

  // `bookings` (local context state, cached in localStorage) is only a
  // stand-in for offline dev mode — falling through to it unconditionally
  // while the real fetch is in flight meant a guest could briefly see
  // "No bookings yet" (empty local cache) or, worse, another account's
  // stale cached bookings on a shared device, on every real page load.
  const allBookings = liveBookings ?? (isBackendEnabled() ? [] : bookings);

  const resolveEvent = (b: Booking) =>
    b.event ?? eventById(b.eventId) ?? myEvents.find((e) => e.id === b.eventId);

  const list = useMemo(() => {
    const now = Date.now();
    return allBookings.filter((b) => {
      const ev = resolveEvent(b);
      if (!ev) return false;
      const isPast = new Date(ev.date).getTime() < now;
      return tab === 'past' ? isPast : !isPast;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBookings, tab, myEvents]);

  const selected = list.find((b) => b.id === selectedId) ?? list[0];
  const event = selected ? resolveEvent(selected) : undefined;
  const venue = event ? (event.venue ?? (event.venueId ? venueById(event.venueId) : undefined)) : undefined;

  const doRefund = async (id: string, refundTo: 'wallet' | 'source') => {
    if (liveBookings) {
      try {
        await bookingsApi.cancel(id, refundTo);
        refetchLive();
        if (refundTo === 'wallet') refreshWallet(); // instant wallet credit, unlike a source refund which needs admin approval first
      } catch {
        // surfaced nowhere specific — the booking simply won't show as refunded; safe to retry
      }
    } else {
      refundBooking(id, refundTo);
    }
    setRefundingId(null);
  };

  const doResend = async (id: string) => {
    setResendingId(id);
    try {
      await bookingsApi.resend(id);
      toast('Ticket resent to your WhatsApp ✓');
    } catch {
      toast('Could not resend — try again in a moment');
    }
    setResendingId(null);
  };

  return (
    <main className="page">
      <div className="container">
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>My Bookings</h1>
        <div className="tabs">
          <button className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>
            Upcoming
          </button>
          <button className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>
            Past
          </button>
        </div>

        {loading ? (
          <div className="tiny muted">Loading…</div>
        ) : list.length === 0 ? (
          <div className="empty">
            No {tab} bookings yet.{' '}
            <Link to={cityBrowse(city)} className="link">
              Browse events →
            </Link>
          </div>
        ) : (
          <div className="bookings-grid">
            <div className="blist">
              {list.map((b) => {
                const ev = resolveEvent(b);
                return (
                  <button
                    key={b.id}
                    className={`blist-item ${selected?.id === b.id ? 'on' : ''}`}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <div className="t">{ev?.title}</div>
                    <div className="m">
                      {ev && fmtDate(ev.date)} · {b.qty} tix
                      {b.status === 'cancelled' && (
                        <span className="danger-text"> · cancelled</span>
                      )}
                      {(b.status === 'refunded' || b.status === 'refund_requested') && (
                        <span className="accent"> · {b.status === 'refunded' ? 'refunded' : 'refund pending'}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected && event && (
              <div className="card card-shadow" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <h2 style={{ fontSize: 20 }}>{event.title}</h2>
                  <div style={{ display: 'grid', gap: 7, margin: '12px 0', fontSize: 14 }} className="muted">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Calendar size={13} /> {fmtDate(event.date)}, {fmtTime(event.date)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={13} /> {eventLocation(event, venue)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ticket size={13} /> {selected.tierName} · {selected.id}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <CreditCard size={13} /> Paid ₹{selected.total} ·{' '}
                      {selected.status === 'confirmed' ? (
                        <span className="badge badge-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Confirmed <CheckCircle2 size={13} /></span>
                      ) : (
                        <span className={`badge ${REFUND_BADGE[selected.status].cls}`}>{REFUND_BADGE[selected.status].label}</span>
                      )}
                    </span>
                  </div>
                  <div className="small muted-2" style={{ marginBottom: 14 }}>
                    Guests: {selected.guests.map((g) => g.name).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {selected.status === 'confirmed' && liveBookings && (
                      <button className="btn btn-ghost btn-sm" disabled={resendingId === selected.id} onClick={() => doResend(selected.id)}>
                        {resendingId === selected.id ? 'Resending…' : 'Resend to WhatsApp'}
                      </button>
                    )}
                    {selected.status === 'confirmed' && refundingId !== selected.id && (
                      <button className="btn btn-danger btn-sm" onClick={() => setRefundingId(selected.id)}>
                        Cancel booking
                      </button>
                    )}
                  </div>
                  {selected.status === 'confirmed' && refundingId === selected.id && (
                    <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, marginTop: 12 }}>
                      <div className="small bold" style={{ marginBottom: 8 }}>
                        Cancel &amp; refund ₹{selected.total} — where should it go?
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <button
                          className="btn btn-pri btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          onClick={() => doRefund(selected.id, 'wallet')}
                        >
                          <Wallet size={14} /> Prebooze wallet — instant credit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          onClick={() => doRefund(selected.id, 'source')}
                        >
                          <CreditCard size={14} /> Original payment method — 5–7 business days
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setRefundingId(null)}>
                          Keep my booking
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {selected.status === 'confirmed' && (
                  <div style={{ textAlign: 'center' }}>
                    <QRCode value={selected.qrToken || selected.id} caption={`valid for ${selected.guests.length} guest${selected.guests.length > 1 ? 's' : ''}`} />
                    <div style={{ marginTop: 10 }}>
                      <button className="btn btn-pri btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => downloadTicket(selected, event, venue)}>
                        <Download size={13} /> Download ticket
                      </button>{' '}
                      <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => downloadIcs(event, venue)}>
                        <Calendar size={13} /> Add to calendar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
