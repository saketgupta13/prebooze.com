import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Tag } from '../components/ui';
import { useBranding } from '../lib/useBranding';
import { liveInvoices, LiveApiError, type LiveInvoice } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Invoice detail';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const ROLE_LABEL: Record<string, string> = { guest: 'Guest', organizer: 'Organizer', promoter: 'Promoter', venue: 'Venue', lineup: 'Line-up' };

/** Real invoice — real server-generated PDF download (authenticated
 * blob fetch, InvoicesService.pdf) and real resend-email/resend-whatsapp,
 * not the print-css stand-in the mock used before a live PDF endpoint
 * existed. */
export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;
  const { logoUrl } = useBranding();

  const [inv, setInv] = useState<LiveInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    liveInvoices
      .get(id)
      .then(setInv)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!loading && !inv) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Invoice not found</h1>
        <Link to="/invoices" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Invoices</Link>
      </div>
    );
  }
  if (!inv) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const download = async () => {
    setBusy('pdf');
    try {
      await liveInvoices.downloadPdf(inv.id, `${inv.number}.pdf`);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to download');
    } finally {
      setBusy(null);
    }
  };

  const resend = async (channel: 'email' | 'whatsapp') => {
    setBusy(channel);
    setErr('');
    try {
      if (channel === 'email') await liveInvoices.resendEmail(inv.id);
      else await liveInvoices.resendWhatsapp(inv.id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : `Failed to resend via ${channel}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 720, gap: 14 }}>
      {err && <div className="card no-print" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/invoices" style={{ fontSize: 13 }}>← Invoices</Link>
        <h1 className="page-title">{inv.number}</h1>
        {inv.status === 'issued' ? <Tag label="Issued" cls="tag-green" /> : <Tag label="Void" cls="tag-dim" />}
        <div style={{ flex: 1 }} />
        <button className="btn btn-pri btn-sm" disabled={busy === 'pdf'} onClick={download}>⬇ Download PDF</button>
        <button className="btn btn-ghost btn-sm" disabled={!inv.payerEmail || busy === 'email'} onClick={() => resend('email')} title={inv.payerEmail ?? 'No email on file'}>
          ✉ Resend email
        </button>
        <button className="btn btn-ghost btn-sm" disabled={!inv.payerPhone || busy === 'whatsapp'} onClick={() => resend('whatsapp')} title={inv.payerPhone ?? 'No phone on file'}>
          💬 Resend WhatsApp
        </button>
      </div>
      {inv.lastSentAt && <div className="tiny hint no-print" style={{ marginTop: -8 }}>last sent {new Date(inv.lastSentAt).toLocaleString()}</div>}

      <div className="card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <img src={logoUrl || '/logo.png'} alt="Prebooze" style={{ height: 28, width: 'auto', display: 'block', marginBottom: 4 }} />
            <div className="tiny muted">Invoice</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12.5 }}>
            <div>Invoice No.: <b>{inv.number}</b></div>
            <div className="muted">Date: {new Date(inv.issuedAt).toLocaleDateString('en-IN')}</div>
            <div className="muted">Status: {inv.status === 'issued' ? 'Issued' : 'Void'}</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(139,195,74,.15)', paddingTop: 16, marginBottom: 20 }}>
          <div className="tiny muted" style={{ marginBottom: 4 }}>BILL TO</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.payerName}</div>
          {inv.payerEmail && <div className="tiny muted">{inv.payerEmail}</div>}
          {inv.payerPhone && <div className="tiny muted">{inv.payerPhone}</div>}
          {inv.city && <div className="tiny muted">{inv.city}</div>}
          <div className="tiny muted">Role: {ROLE_LABEL[inv.role] ?? inv.role}</div>
        </div>

        <div className="tblwrap" style={{ marginBottom: 12 }}>
          <div className="thead">
            <span style={{ flex: 2 }}>Description</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Amount</span>
          </div>
          <div className="trow">
            <span style={{ flex: 2 }}>{inv.description}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>₹{fmt(inv.subtotal)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', fontSize: 13 }}>
          <div style={{ display: 'flex', gap: 24, fontWeight: 700, fontSize: 15, borderTop: '1px solid rgba(139,195,74,.25)', paddingTop: 6, marginTop: 4 }}>
            <span>TOTAL</span>
            <span style={{ width: 90, textAlign: 'right' }} className="green">₹{fmt(inv.total)}</span>
          </div>
        </div>

        <div className="tiny hint" style={{ marginTop: 28, textAlign: 'center' }}>
          This is a system-generated invoice from Prebooze. For questions, contact support via the app.
        </div>
      </div>

      <div className="tiny hint no-print">
        linked {inv.type === 'booking' ? 'booking' : 'featured request'}: <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => navigate(inv.type === 'booking' ? `/bookings/${encodeURIComponent(inv.refId)}` : '/featured')}>{inv.refId} →</button>
      </div>
    </div>
  );
}
