import { useEffect, useState } from 'react';
import { liveCarts, LiveApiError, type LiveCart } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Abandoned carts (live)';
const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Real active carts — remind/bulk-remind genuinely sends a real WhatsApp +
 * email nudge (CartsService.remind), not a mock toast. */
export default function AbandonedCartsLive() {
  const session = useLiveSession();
  const { token } = session;
  const [carts, setCarts] = useState<LiveCart[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveCarts
      .list()
      .then(setCarts)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const remind = async (id: string) => {
    try {
      await liveCarts.remind(id);
      setMsg('Reminder sent ✓');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send reminder');
    }
  };

  const bulkRemind = async () => {
    if (!selected.length) return;
    try {
      const res = await liveCarts.bulkRemind(selected);
      setMsg(`${res.count} reminder(s) sent ✓`);
      setSelected([]);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send reminders');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {msg && <div className="tiny" style={{ color: 'var(--green)' }}>{msg}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <button className="btn btn-pri" disabled={!selected.length} onClick={bulkRemind} style={{ alignSelf: 'flex-start' }}>
        Remind selected ({selected.length})
      </button>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 640 }}>
          <span style={{ width: 24 }} />
          <span style={{ flex: 1.6 }}>Guest / event</span>
          <span style={{ flex: 0.8 }}>Amount</span>
          <span style={{ flex: 0.8 }} />
        </div>
        {carts.length === 0 && !loading && <div className="trow muted">No active abandoned carts.</div>}
        {carts.map((c) => (
          <div key={c.id} className="trow" style={{ minWidth: 640 }}>
            <span style={{ width: 24 }}>
              <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))} />
            </span>
            <span style={{ flex: 1.6 }}>
              <div style={{ fontWeight: 700 }}>{c.guest}</div>
              <div className="tiny muted">{c.eventTitle} · {c.phone}</div>
            </span>
            <span style={{ flex: 0.8 }}>{fmtMoney(c.amount)}</span>
            <span style={{ flex: 0.8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => remind(c.id)}>{c.reminded ? 'Remind again' : 'Remind'}</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
