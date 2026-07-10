import { PAYOUTS, fmtMoney } from '../../data/mock';

export default function Payouts() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Payouts</h1>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi" style={{ borderColor: 'rgba(155,225,61,.4)' }}>
          <div className="l">Available balance</div>
          <div className="v accent">₹84,320</div>
          <button className="btn btn-pri btn-sm" style={{ marginTop: 10 }}>
            Withdraw now
          </button>
        </div>
        <div className="kpi">
          <div className="l">Pending (settles after event)</div>
          <div className="v">₹31,750</div>
        </div>
        <div className="kpi">
          <div className="l">Lifetime paid out</div>
          <div className="v">₹4.2L</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="small">
          Payout to <span className="bold">HDFC •••• 8821</span> <span className="verified">✓</span>{' '}
          <span className="muted">· weekly auto-payout every Monday</span>
        </span>
        <button className="btn btn-ghost btn-sm">change</button>
      </div>

      <div className="card tbl-wrap">
        <h3 style={{ marginBottom: 10 }}>Payout history</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {PAYOUTS.map((p) => (
              <tr key={p.date + p.event}>
                <td>{p.date}</td>
                <td className="bold">{p.event}</td>
                <td>{fmtMoney(p.amount)}</td>
                <td>
                  {p.status === 'paid' ? (
                    <span className="badge badge-ok">Paid ✓</span>
                  ) : (
                    <span className="badge badge-pending">Processing ◌</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>
          ⬇ Download statements (CSV / PDF)
        </button>
      </div>
    </div>
  );
}
