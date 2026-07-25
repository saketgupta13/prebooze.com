import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { Tag } from '../components/ui';

const ROLE_LABEL: Record<string, string> = { guest: 'Guest', organizer: 'Organizer', promoter: 'Promoter', venue: 'Venue', lineup: 'Line-up' };

/** Real print output — @media print hides everything except the invoice
 * card, so "Download" (browser print → Save as PDF) produces the actual
 * invoice, not a fake button. The real backend (prebooze-api's
 * InvoicesService) generates a byte-for-byte real PDF server-side with the
 * same layout; this is the mock-admin-side equivalent until this page is
 * wired to that live endpoint. */
export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoices, resendInvoiceEmail, resendInvoiceWhatsapp } = useAdmin();
  const inv = invoices.find((i) => i.id === id);

  if (!inv) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Invoice not found</h1>
        <Link to="/invoices" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Invoices</Link>
      </div>
    );
  }

  return (
    <div className="stack fade" style={{ maxWidth: 720, gap: 14 }}>
      <style>{`
        @media print {
          .topbar, .sidebar, .no-print { display: none !important; }
          .shell { display: block !important; }
          body, .app-bg { background: #fff !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/invoices" style={{ fontSize: 13 }}>← Invoices</Link>
        <h1 className="page-title">{inv.number}</h1>
        {inv.status === 'issued' ? <Tag label="Issued" cls="tag-green" /> : <Tag label="Void" cls="tag-dim" />}
        <div style={{ flex: 1 }} />
        <button className="btn btn-pri btn-sm" onClick={() => window.print()}>⬇ Download / Print</button>
        <button className="btn btn-ghost btn-sm" disabled={!inv.payerEmail} onClick={() => resendInvoiceEmail(inv.id)} title={inv.payerEmail ?? 'No email on file'}>
          ✉ Resend email
        </button>
        <button className="btn btn-ghost btn-sm" disabled={!inv.payerPhone} onClick={() => resendInvoiceWhatsapp(inv.id)} title={inv.payerPhone ?? 'No phone on file'}>
          💬 Resend WhatsApp
        </button>
      </div>
      {inv.lastSentAt && <div className="tiny hint no-print" style={{ marginTop: -8 }}>last sent {new Date(inv.lastSentAt).toLocaleString()}</div>}

      <div className="card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <img src="/logo.png" alt="Prebooze" style={{ height: 28, width: 'auto', display: 'block', marginBottom: 4 }} />
            <div className="tiny muted">Tax Invoice</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12.5 }}>
            <div>Invoice No.: <b>{inv.number}</b></div>
            <div className="muted">Date: {inv.issuedAt}</div>
            <div className="muted">Status: {inv.status === 'issued' ? 'Issued' : 'Void'}</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(139,195,74,.15)', paddingTop: 16, marginBottom: 20 }}>
          <div className="tiny muted" style={{ marginBottom: 4 }}>BILL TO</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.payerName}</div>
          <div className="tiny muted">{inv.payerEmail}</div>
          <div className="tiny muted">{inv.payerPhone}</div>
          <div className="tiny muted">{inv.city}</div>
          <div className="tiny muted">Role: {ROLE_LABEL[inv.role]}</div>
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
          {inv.gstAmount > 0 && (
            <div style={{ display: 'flex', gap: 24 }}>
              <span className="muted">GST ({inv.gstPct}%)</span>
              <span style={{ width: 90, textAlign: 'right' }}>₹{fmt(inv.gstAmount)}</span>
            </div>
          )}
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
