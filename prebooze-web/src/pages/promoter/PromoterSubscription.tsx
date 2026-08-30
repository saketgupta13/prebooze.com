import { useEffect, useState } from 'react';
import { promoter, type PromoterMe } from '../../api';
import { ApiError } from '../../api/client';
import SubscriptionPlans from '../../components/SubscriptionPlans';
import PromoteCard from '../../components/PromoteCard';
import Loader from '../../components/Loader';
import type { Invoice } from '../../types';
import { X, Download } from 'lucide-react';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Subscription tiers (real guest-quota gating, unlike organizer/venue/
 * line-up which have no real plan-tier system and replaced this page with
 * pure Featured billing) plus real Featured purchase + invoice history —
 * same PromoteCard + GET /promoter/invoices pattern those other three roles
 * already have on their own Billing pages. */
export default function PromoterSubscription() {
  const [me, setMe] = useState<PromoterMe | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([promoter.me(), promoter.usage(), promoter.invoices()])
      .then(([m, u, inv]) => { setMe(m); setUsage(u); setInvoices(inv); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const download = async (inv: Invoice) => {
    setDownloadingId(inv.id);
    try {
      await promoter.downloadInvoicePdf(inv.id, `${inv.number}.pdf`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <Loader />;
  if (!me) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Subscription &amp; featured</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Your plan sets how many guests you can add to lists each month. Upgrade any time — changes apply once payment
        is confirmed.
      </p>
      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}
      <SubscriptionPlans api={promoter.subscription} usage={usage} />

      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 4 }}>Get featured</h3>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Real Razorpay billing — boost your public profile to the top of the promoters directory and Home page.
        </p>
        <PromoteCard type="promoter" refId={me.slug} city={me.city || 'Hyderabad'} label="your PR profile" />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Invoice history</h3>
        {invoices.length === 0 && <div className="muted small">No invoices yet — they show up here once you feature your profile.</div>}
        {invoices.map((inv) => (
          <div key={inv.id} className="evrow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small">{inv.number} · {fmtMoney(inv.total)}</div>
              <div className="tiny muted-2">{inv.description} · {fmtDate(inv.issuedAt)}</div>
            </div>
            <span className={`badge ${inv.status === 'issued' ? 'badge-ok' : 'badge-pending'}`}>
              {inv.status === 'issued' ? 'Issued' : 'Void'}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={downloadingId === inv.id} onClick={() => download(inv)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {downloadingId === inv.id ? 'Downloading…' : <><Download size={14} /> Download PDF</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
