import { useEffect, useState } from 'react';
import { liveInvoices, LiveApiError, type LiveInvoice } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Invoices (live)';
const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Real invoices — PDF download is a genuine authenticated fetch+blob (the
 * endpoint requires the staff bearer token, so a plain <a href> wouldn't
 * work), and resend-email/resend-whatsapp really re-send via the same
 * EmailService/WhatsappService every other real notification uses. */
export default function InvoicesLive() {
  const session = useLiveSession();
  const { token } = session;
  const [invoices, setInvoices] = useState<LiveInvoice[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    liveInvoices
      .list(role ? { role } : undefined)
      .then(setInvoices)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const download = async (inv: LiveInvoice) => {
    setBusyId(inv.id);
    try {
      await liveInvoices.downloadPdf(inv.id, `${inv.number}.pdf`);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to download');
    } finally {
      setBusyId(null);
    }
  };

  const resend = async (inv: LiveInvoice, channel: 'email' | 'whatsapp') => {
    setBusyId(inv.id);
    try {
      if (channel === 'email') await liveInvoices.resendEmail(inv.id);
      else await liveInvoices.resendWhatsapp(inv.id);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : `Failed to resend via ${channel}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {['', 'guest', 'organizer', 'promoter', 'venue', 'lineup'].map((r) => (
          <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>{r || 'All'}</button>
        ))}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 780 }}>
          <span style={{ flex: 1.2 }}>Invoice</span>
          <span style={{ flex: 1 }}>Payer</span>
          <span style={{ flex: 0.8 }}>Total</span>
          <span style={{ flex: 0.7 }}>Role</span>
          <span style={{ flex: 1.4 }}>Actions</span>
        </div>
        {invoices.length === 0 && !loading && <div className="trow muted">No invoices in this view.</div>}
        {invoices.map((inv) => (
          <div key={inv.id} className="trow" style={{ minWidth: 780, flexWrap: 'wrap' }}>
            <span style={{ flex: 1.2, fontWeight: 700 }}>{inv.number}</span>
            <span style={{ flex: 1 }}>
              <div>{inv.payerName}</div>
              <div className="tiny muted">{inv.city || '—'} · {new Date(inv.issuedAt).toLocaleDateString('en-IN')}</div>
            </span>
            <span style={{ flex: 0.8 }}>{fmtMoney(inv.total)}</span>
            <span style={{ flex: 0.7 }} className="muted">{inv.role}</span>
            <span style={{ flex: 1.4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" disabled={busyId === inv.id} onClick={() => download(inv)}>PDF</button>
              <button className="btn btn-ghost btn-sm" disabled={busyId === inv.id} onClick={() => resend(inv, 'email')}>Resend email</button>
              <button className="btn btn-ghost btn-sm" disabled={busyId === inv.id} onClick={() => resend(inv, 'whatsapp')}>Resend WhatsApp</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
