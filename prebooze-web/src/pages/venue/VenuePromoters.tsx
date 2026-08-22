import { useEffect, useState } from 'react';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import Loader from '../../components/Loader';

const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface VenuePromoter {
  promoterId: string; promoterSlug: string; promoterName: string; city: string; bio: string; contact: string | null; verified: boolean;
  bankName: string | null; bankAccountNumber: string | null; bankLast4: string | null; accountHolderName: string | null; ifsc: string | null;
  eventCount: number; totalOwed: number; pendingEvents: number;
}

/** Venue-hosted equivalent of organizer/OrganizerPromoters.tsx — every
 * promoter allowed on this venue's own hosted events, their profile,
 * real bank details, and what's owed, via GET /venue/hosting/promoters. */
export default function VenuePromoters() {
  const [rows, setRows] = useState<VenuePromoter[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showBank, setShowBank] = useState<string | null>(null);

  useEffect(() => {
    venuePartner
      .promoters()
      .then(setRows)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load promoters'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Promoters</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Everyone you've allowed to promote your hosted events — their profile, bank details for paying them out, and
        what you owe. Real transfers happen outside Prebooze.
      </p>
      {err && <div className="danger-text small" style={{ marginBottom: 12 }}>✕ {err}</div>}

      {rows.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: 30, marginBottom: 10 }}>📣</div>
          No promoters yet. Add some from an event's Promoters step when creating or editing a hosted event.
        </div>
      ) : (
        <div className="stack" style={{ display: 'grid', gap: 12 }}>
          {rows.map((p) => (
            <div key={p.promoterId} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 16 }}>{p.promoterName}</h3>
                    {p.verified && <span className="verified">✓</span>}
                  </div>
                  <div className="muted small">{p.city}{p.contact && <> · {p.contact}</>}</div>
                  {p.bio && <div className="tiny muted-2" style={{ marginTop: 4, maxWidth: 480 }}>{p.bio}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="bold" style={{ fontSize: 18 }}>{fmtMoney(p.totalOwed)}</div>
                  <div className="tiny muted-2">
                    {p.eventCount} event{p.eventCount === 1 ? '' : 's'}
                    {p.pendingEvents > 0 && <> · <span className="danger-text">{p.pendingEvents} unpaid</span></>}
                  </div>
                </div>
              </div>

              <div className="hr" />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="bold small">Bank for payout</div>
                  <div className="tiny muted">
                    {p.bankLast4 ? `${p.bankName ? p.bankName + ' · ' : ''}•••• ${p.bankLast4}` : 'no bank details on file yet'}
                  </div>
                </div>
                {p.bankAccountNumber && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowBank((s) => (s === p.promoterId ? null : p.promoterId))}>
                    {showBank === p.promoterId ? 'Hide' : 'Show full details'}
                  </button>
                )}
              </div>
              {showBank === p.promoterId && p.bankAccountNumber && (
                <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, marginTop: 10, fontSize: 13, display: 'grid', gap: 4 }}>
                  <div>Account holder: <b>{p.accountHolderName}</b></div>
                  <div>Account number: <b>{p.bankAccountNumber}</b></div>
                  <div>IFSC: <b>{p.ifsc}</b></div>
                  <div>Bank: <b>{p.bankName}</b></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
