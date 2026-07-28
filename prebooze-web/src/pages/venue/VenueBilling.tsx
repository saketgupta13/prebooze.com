import { useEffect, useState } from 'react';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import PromoteCard from '../../components/PromoteCard';
import Loader from '../../components/Loader';
import type { Invoice, Venue } from '../../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Replaces the old venue "Subscription" page — same reasoning as
 * OrganizerBilling.tsx: there's no real plan-tier system that anything
 * reads at request time for venue either, so real billing is pay-per-
 * feature (Featured placements) instead. Real PromoteCard purchase flow
 * plus real invoice history (GET /venue/invoices, same Invoice rows admin
 * sees, filtered to this venue partner), with actual PDF downloads. */
export default function VenueBilling() {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([venuePartner.myListing(), venuePartner.invoices()])
      .then(([v, inv]) => { setVenue(v); setInvoices(inv); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const download = async (inv: Invoice) => {
    setDownloadingId(inv.id);
    try {
      await venuePartner.downloadInvoicePdf(inv.id, `${inv.number}.pdf`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <Loader />;
  if (!venue) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Featured & billing</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Feature your venue for real Razorpay billing — no subscription tiers, just pay for what you use.
      </p>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

      <PromoteCard type="venue" refId={venue.id} city={venue.city} label="your venue" />

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Invoice history</h3>
        {invoices.length === 0 && <div className="muted small">No invoices yet — they show up here once you feature your venue.</div>}
        {invoices.map((inv) => (
          <div key={inv.id} className="evrow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small">{inv.number} · {fmtMoney(inv.total)}</div>
              <div className="tiny muted-2">{inv.description} · {fmtDate(inv.issuedAt)}</div>
            </div>
            <span className={`badge ${inv.status === 'issued' ? 'badge-ok' : 'badge-pending'}`}>
              {inv.status === 'issued' ? 'Issued' : 'Void'}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={downloadingId === inv.id} onClick={() => download(inv)}>
              {downloadingId === inv.id ? 'Downloading…' : '⬇ Download PDF'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
