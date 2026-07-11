import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { EVENT_STATUS, Tag } from '../components/ui';

const BOOKING_FEE = 30;
const GST_PCT = 18;

type EditorTab = 'basics' | 'tickets' | 'commission';

export default function EventEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { events, updateEvent, approveEvent, rejectEvent, toast } = useAdmin();
  const [tab, setTab] = useState<EditorTab>('basics');

  const event = events.find((e) => e.id === id);
  if (!event) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Event not found</h1>
        <Link to="/events" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Events</Link>
      </div>
    );
  }

  const sm = EVENT_STATUS[event.status];
  const commission = event.commission ?? 10;
  const previewPrice = event.tiers[Math.min(1, event.tiers.length - 1)].price;
  const gstAmt = (BOOKING_FEE * GST_PCT) / 100;
  const guestPays = previewPrice + BOOKING_FEE + gstAmt;
  const platformKeeps = (previewPrice * commission) / 100 + BOOKING_FEE;
  const organizerNets = previewPrice - (previewPrice * commission) / 100;

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/events" style={{ fontSize: 13 }}>← Events</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{event.title}</h1>
        <Tag {...sm} />
        <div style={{ flex: 1 }} />
        {event.status === 'pending' && (
          <>
            <button className="btn btn-pri btn-sm" onClick={() => approveEvent(event.id)}>Approve ✓</button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                rejectEvent(event.id);
                navigate('/events');
              }}
            >
              Reject
            </button>
          </>
        )}
        <button className="btn btn-pri btn-sm" onClick={() => toast('Event saved ✓')}>Save</button>
      </div>

      <div className="tabs">
        {(['basics', 'tickets', 'commission'] as EditorTab[]).map((t, i) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {i + 1} · {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'basics' && (
        <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="input" style={{ gridColumn: '1 / 3' }}>{event.title}</div>
          <div className="input" style={{ color: '#c7cbb9' }}>Category: {event.category}</div>
          <div className="input" style={{ color: '#c7cbb9' }}>Venue: {event.venue}</div>
          <div className="input" style={{ color: '#c7cbb9' }}>{event.date}, {event.time}</div>
          <div className="input" style={{ color: '#c7cbb9' }}>Organizer: {event.organizer}</div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="stack" style={{ gap: 8 }}>
          {event.tiers.map((t) => (
            <div key={t.name} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, padding: '10px 12px' }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{t.name}</span>
              <span style={{ flex: 1 }} className="muted">₹{fmt(t.price)}</span>
              <span style={{ flex: 1 }} className="muted">
                {fmt(t.qty)} qty · {t.sold >= t.qty ? 'sold out' : `${fmt(t.sold)} sold`}
              </span>
            </div>
          ))}
          <div className="tiny hint">+ add tier (supports per-tier sale window, per-person limit)</div>
        </div>
      )}

      {tab === 'commission' && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="display" style={{ fontWeight: 700 }}>Commission &amp; fees — this event only</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 160 }}>Platform commission</span>
              <input
                className="input"
                style={{ width: 70, textAlign: 'center' }}
                value={String(commission)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  updateEvent(event.id, { commission: v === '' ? 0 : parseFloat(v) });
                }}
              />
              <span className="muted">%</span>
              <span className="tiny hint">negotiated with organizer</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 160 }}>Booking fee (per ticket)</span>
              <span style={{ color: '#c7cbb9' }}>₹{BOOKING_FEE}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 160 }}>GST on platform fee</span>
              <span style={{ color: '#c7cbb9' }}>{GST_PCT}%</span>
            </div>
          </div>

          <div className="dashed-box">
            <b style={{ color: 'var(--text)' }}>Live preview — ₹{fmt(previewPrice)} ticket:</b> guest pays{' '}
            <b style={{ color: 'var(--text)' }}>₹{fmt(guestPays)}</b> · platform keeps{' '}
            <b className="green">₹{fmt(platformKeeps)}</b> · organizer nets{' '}
            <b style={{ color: 'var(--text)' }}>₹{fmt(organizerNets)}</b>
          </div>
          <div className="tiny hint">
            Commission is set per event — there is no global rate. Locks once the event goes live.
          </div>
        </div>
      )}
    </div>
  );
}
