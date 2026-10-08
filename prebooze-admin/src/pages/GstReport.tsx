import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { liveReports, LiveApiError, type LiveGstReport, type LiveTcsReport } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { downloadCsv } from '../lib/csv';

const TITLE = 'GST & TCS report';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function toMonthInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** Real monthly CA-facing exports (2026-10-02) — GET /admin/reports/gst +
 * /admin/reports/tcs (ReportsService.gst/tcs). GST is sourced straight from
 * Invoice (real CGST/SGST/IGST on every booking-fee, commission, Featured
 * and Marketing invoice); TCS is sourced from OrganizerLedgerTx/
 * VenueLedgerTx 'sale' rows' own snapshotted tcsAmount — empty for as long
 * as PlatformSettings.tcsEnabled stays off, which is deliberate until the
 * CA confirms real multi-state TCS registration. Meant to be pulled on the
 * 1st of each month and handed straight to the CA, CSV included. */
export default function GstReport() {
  const session = useLiveSession();
  const { token } = session;
  const [month, setMonth] = useState(() => toMonthInput(new Date()));
  const [gst, setGst] = useState<LiveGstReport | null>(null);
  const [tcs, setTcs] = useState<LiveTcsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setErr('');
    Promise.all([liveReports.gst(month), liveReports.tcs(month)])
      .then(([g, t]) => { setGst(g); setTcs(t); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [token, month]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const exportGstCsv = () => {
    if (!gst) return;
    const rows: (string | number)[][] = [
      [`Prebooze — GST output report`, monthLabel(month)],
      ['Source', 'Count', 'Taxable value (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total GST (₹)'],
      ...gst.sources.map((s) => [s.label, s.count, s.taxableValue, s.cgst, s.sgst, s.igst, s.gstTotal]),
      ['Total', gst.sources.reduce((a, s) => a + s.count, 0), gst.totals.taxableValue, gst.totals.cgst, gst.totals.sgst, gst.totals.igst, gst.totals.gstTotal],
      [],
      ['Invoice #', 'Date', 'Type', 'Payer', 'Brand', 'GSTIN', 'City', 'Taxable value (₹)', 'GST %', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total (₹)'],
      ...gst.invoices.map((i) => [i.number, fmtDate(i.date), i.type, i.payerName, i.payerBrand ?? '', i.payerGstin ?? '', i.city ?? '', i.taxableValue, i.gstPct, i.cgst, i.sgst, i.igst, i.total]),
    ];
    downloadCsv(`prebooze-gst-${month}.csv`, rows);
  };

  const exportTcsCsv = () => {
    if (!tcs) return;
    const rows: (string | number)[][] = [
      [`Prebooze — TCS report (GSTR-8 shaped)`, monthLabel(month)],
      ['Supplier', 'Type', 'GSTIN', 'State', 'Gross value of supplies (₹)', 'TCS collected (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)'],
      ...tcs.rows.map((r) => [r.payeeName, r.payeeType, r.gstin ?? '', r.state ?? '', r.grossValue, r.tcsAmount, r.cgst, r.sgst, r.igst]),
      ['Total', '', '', '', tcs.totals.grossValue, tcs.totals.tcsAmount, tcs.totals.cgst, tcs.totals.sgst, tcs.totals.igst],
    ];
    downloadCsv(`prebooze-tcs-${month}.csv`, rows);
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/reports" style={{ fontSize: 13 }}>← Reports</Link>
        <h1 className="page-title" style={{ marginBottom: 0 }}>GST &amp; TCS report</h1>
        <div style={{ flex: 1 }} />
        <input className="input" type="month" style={{ width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <p className="tiny muted" style={{ marginTop: -8 }}>
        Pull this on the 1st of the month for {monthLabel(month)} and hand it to the CA — real CGST/SGST/IGST off every
        issued invoice, plus the TCS withheld on organizers'/venues' own GSTINs (GST Act s.52).
      </p>

      {loading && <div className="tiny muted">Loading…</div>}

      {gst && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            <h3 style={{ marginBottom: 0 }}>GST output — what Prebooze owes the government</h3>
            <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={exportGstCsv} disabled={!gst.invoices.length}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <p className="tiny muted" style={{ marginBottom: 12 }}>
            Booking fees are taxed on the fee only (the ticket price itself carries no GST) — every other source is
            taxed on its full amount.
          </p>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 640 }}>
              <span style={{ flex: 1.6 }}>Source</span>
              <span style={{ flex: 0.6 }}>Count</span>
              <span style={{ flex: 1 }}>Taxable value</span>
              <span style={{ flex: 0.8 }}>CGST</span>
              <span style={{ flex: 0.8 }}>SGST</span>
              <span style={{ flex: 0.8 }}>IGST</span>
              <span style={{ flex: 0.9 }}>Total GST</span>
            </div>
            {gst.sources.map((s) => (
              <div key={s.type} className="trow" style={{ minWidth: 640 }}>
                <span style={{ flex: 1.6 }}>{s.label}</span>
                <span style={{ flex: 0.6 }} className="muted">{s.count}</span>
                <span style={{ flex: 1 }}>₹{fmt(s.taxableValue)}</span>
                <span style={{ flex: 0.8 }} className="muted">₹{fmt(s.cgst)}</span>
                <span style={{ flex: 0.8 }} className="muted">₹{fmt(s.sgst)}</span>
                <span style={{ flex: 0.8 }} className="muted">₹{fmt(s.igst)}</span>
                <span style={{ flex: 0.9, fontWeight: 700 }}>₹{fmt(s.gstTotal)}</span>
              </div>
            ))}
            <div className="trow" style={{ minWidth: 640, fontWeight: 700, borderTop: '1px solid var(--border, rgba(139,195,74,.15))' }}>
              <span style={{ flex: 1.6 }}>Total</span>
              <span style={{ flex: 0.6 }}>{gst.sources.reduce((a, s) => a + s.count, 0)}</span>
              <span style={{ flex: 1 }}>₹{fmt(gst.totals.taxableValue)}</span>
              <span style={{ flex: 0.8 }}>₹{fmt(gst.totals.cgst)}</span>
              <span style={{ flex: 0.8 }}>₹{fmt(gst.totals.sgst)}</span>
              <span style={{ flex: 0.8 }}>₹{fmt(gst.totals.igst)}</span>
              <span style={{ flex: 0.9, color: 'var(--green)' }}>₹{fmt(gst.totals.gstTotal)}</span>
            </div>
          </div>
          {gst.invoices.length === 0 && <div className="tiny muted" style={{ marginTop: 10 }}>No GST-bearing invoices issued in {monthLabel(month)}.</div>}
        </div>
      )}

      {gst && gst.invoices.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>GST transactions</h3>
          <p className="tiny muted" style={{ marginBottom: 12 }}>Every invoice behind the summary above, real CGST/SGST/IGST per row.</p>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 820 }}>
              <span style={{ flex: 1 }}>Invoice #</span>
              <span style={{ flex: 0.7 }}>Date</span>
              <span style={{ flex: 0.9 }}>Type</span>
              <span style={{ flex: 1.4 }}>Payer</span>
              <span style={{ flex: 1.1 }}>GSTIN</span>
              <span style={{ flex: 1 }}>Taxable value</span>
              <span style={{ flex: 1.1 }}>CGST / SGST / IGST</span>
              <span style={{ flex: 0.9 }}>Total</span>
            </div>
            {gst.invoices.map((i) => (
              <div key={i.number} className="trow" style={{ minWidth: 820 }}>
                <span style={{ flex: 1 }} className="tiny bold">{i.number}</span>
                <span style={{ flex: 0.7 }} className="tiny muted">{fmtDate(i.date)}</span>
                <span style={{ flex: 0.9, textTransform: 'capitalize' }} className="muted">{i.type}</span>
                <span style={{ flex: 1.4 }}>
                  {i.payerBrand ?? i.payerName}
                  {i.city && <span className="tiny muted" style={{ display: 'block' }}>{i.city}</span>}
                </span>
                <span style={{ flex: 1.1 }} className="tiny muted">{i.payerGstin ?? 'not on file'}</span>
                <span style={{ flex: 1 }}>₹{fmt(i.taxableValue)} <span className="tiny muted">({i.gstPct}%)</span></span>
                <span style={{ flex: 1.1 }} className="tiny muted">
                  {i.igst > 0 ? `IGST ₹${fmt(i.igst)}` : `CGST ₹${fmt(i.cgst)} + SGST ₹${fmt(i.sgst)}`}
                </span>
                <span style={{ flex: 0.9, fontWeight: 700 }}>₹{fmt(i.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tcs && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            <h3 style={{ marginBottom: 0 }}>TCS withheld — held under each payee's own GSTIN</h3>
            <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={exportTcsCsv} disabled={!tcs.rows.length}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <p className="tiny muted" style={{ marginBottom: 12 }}>
            Not Prebooze's income or liability — this is money withheld from organizers'/venues' own payouts and
            deposited against their own GSTIN. Empty while TCS collection is off in Settings.
          </p>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 700 }}>
              <span style={{ flex: 1.6 }}>Supplier</span>
              <span style={{ flex: 0.8 }}>Type</span>
              <span style={{ flex: 1.1 }}>GSTIN</span>
              <span style={{ flex: 0.9 }}>State</span>
              <span style={{ flex: 1 }}>Gross value</span>
              <span style={{ flex: 0.9 }}>TCS</span>
            </div>
            {tcs.rows.map((r) => (
              <div key={`${r.payeeType}:${r.payeeId}`} className="trow" style={{ minWidth: 700 }}>
                <span style={{ flex: 1.6, fontWeight: 700 }}>{r.payeeName}</span>
                <span style={{ flex: 0.8 }} className="muted">{r.payeeType}</span>
                <span style={{ flex: 1.1 }} className="tiny muted">{r.gstin ?? 'not on file'}</span>
                <span style={{ flex: 0.9 }} className="muted">{r.state ?? '—'}</span>
                <span style={{ flex: 1 }}>₹{fmt(r.grossValue)}</span>
                <span style={{ flex: 0.9, fontWeight: 700 }}>
                  ₹{fmt(r.tcsAmount)}{' '}
                  <span className="tiny muted">{r.igst > 0 ? `(IGST ₹${fmt(r.igst)})` : `(₹${fmt(r.cgst)}+₹${fmt(r.sgst)})`}</span>
                </span>
              </div>
            ))}
            {tcs.rows.length === 0 && <div className="trow muted">No TCS withheld in {monthLabel(month)}.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
