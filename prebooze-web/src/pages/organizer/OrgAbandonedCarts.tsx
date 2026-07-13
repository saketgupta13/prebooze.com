import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { EVENTS, fmtMoney } from '../../data/mock';

const ago = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** Abandoned-cart recovery for the organizer — carts left on their events, with
 * recoverable ₹ and a (simulated) WhatsApp nudge. Organizer-owned leads. */
export default function OrgAbandonedCarts() {
  const { myEvents, carts, remindCart, toast } = useApp();

  const orgEvents = [
    ...myEvents,
    ...EVENTS.filter((e) => e.organizerId === 'livewire' && !myEvents.some((m) => m.id === e.id)),
  ];
  const orgIds = new Set(orgEvents.map((e) => e.id));
  const [eventF, setEventF] = useState('all');

  const mine = useMemo(
    () => carts.filter((c) => orgIds.has(c.eventId) && (eventF === 'all' || c.eventId === eventF)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [carts, eventF]
  );
  const abandoned = mine.filter((c) => c.status === 'abandoned').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const inProgress = mine.filter((c) => c.status === 'active').length;
  const recovered = mine.filter((c) => c.status === 'completed' && c.remindedAt).length;
  const recoverable = abandoned.reduce((a, c) => a + c.total, 0);

  const remind = (id: string, name: string) => {
    remindCart(id);
    toast(`WhatsApp reminder sent to ${name} ✓`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>
          Abandoned carts <span className="badge badge-pending">recover revenue</span>
        </h1>
        <select value={eventF} onChange={(e) => setEventF(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="all">All events</option>
          {orgEvents.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="l">Abandoned carts</div><div className="v">{abandoned.length}</div></div>
        <div className="kpi"><div className="l">Recoverable</div><div className="v accent">{fmtMoney(recoverable)}</div></div>
        <div className="kpi"><div className="l">In progress</div><div className="v">{inProgress}</div></div>
        <div className="kpi"><div className="l">Recovered after nudge</div><div className="v accent">{recovered}</div></div>
      </div>

      <div className="card">
        <p className="tiny muted-2" style={{ marginBottom: 12 }}>
          These guests reached checkout but didn’t pay before their hold lapsed — you already have their WhatsApp. A
          nudge often brings them back. <span className="muted">(sends are simulated until the backend lands)</span>
        </p>
        {abandoned.length === 0 ? (
          <div className="muted small">No abandoned carts right now — nice. They’ll appear here when a guest leaves checkout without paying.</div>
        ) : (
          <>
            <div className="evrow" style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>
              <span style={{ flex: 1.4 }}>Guest</span>
              <span style={{ flex: 1.6 }}>Event · tickets</span>
              <span style={{ flex: 0.8, textAlign: 'right' }}>Value</span>
              <span style={{ flex: 0.8 }}>Left</span>
              <span style={{ flex: 1.4 }} />
            </div>
            {abandoned.map((c) => (
              <div key={c.id} className="evrow">
                <div style={{ flex: 1.4, minWidth: 0 }}>
                  <div className="bold small">{c.userName}</div>
                  <div className="tiny muted-2">{c.userPhone}</div>
                </div>
                <div style={{ flex: 1.6, minWidth: 0 }}>
                  <div className="small">{c.eventTitle}</div>
                  <div className="tiny muted-2">{c.tierSummary}</div>
                </div>
                <span style={{ flex: 0.8, textAlign: 'right' }} className="bold small">{fmtMoney(c.total)}</span>
                <span style={{ flex: 0.8 }} className="tiny muted-2">{ago(c.updatedAt)}</span>
                <div style={{ flex: 1.4, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                  {c.remindedAt && <span className="badge badge-accent" style={{ fontSize: 10 }}>reminded {ago(c.remindedAt)}</span>}
                  <button className="btn btn-whatsapp btn-sm" onClick={() => remind(c.id, c.userName)}>
                    {c.remindedAt ? '↻ Remind again' : '💬 Send reminder'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>
        recovery nudges are reminder + deep link only (no discount) · carts move to “recovered” once the guest pays
      </div>
    </div>
  );
}
