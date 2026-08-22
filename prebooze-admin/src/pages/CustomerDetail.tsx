import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CUSTOMER_STATUS, Kpi, Tag } from '../components/ui';
import { liveCustomers, liveBookings, LiveApiError, type LiveCustomerDetail, type LiveBooking } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram', x: 'X (Twitter)', facebook: 'Facebook', youtube: 'YouTube',
  linkedin: 'LinkedIn', snapchat: 'Snapchat', tiktok: 'TikTok',
};

const TITLE = 'Customer detail';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const STATUS_TAG: Record<LiveBooking['status'], { label: string; cls: string }> = {
  refund_requested: { label: 'Refund req.', cls: 'tag-red' },
  confirmed: { label: 'Confirmed', cls: 'tag-green' },
  refunded: { label: 'Refunded', cls: 'tag-dim' },
  cancelled: { label: 'Cancelled', cls: '' },
};
const waLink = (phone: string, message: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

/** Full customer detail — profile, KPIs and real booking history, matched
 * by the real userId a Booking actually carries (not a name-matching
 * hack). */
export default function CustomerDetail() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;

  const [customer, setCustomer] = useState<LiveCustomerDetail | null>(null);
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [changingPhone, setChangingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneErr, setPhoneErr] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    Promise.all([liveCustomers.get(id), liveBookings.list()])
      .then(([c, b]) => {
        setCustomer(c);
        setBookings(b);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const history = useMemo(
    () => (customer ? bookings.filter((b) => b.userId === customer.id) : []),
    [bookings, customer],
  );

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!loading && !customer) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Customer not found</h1>
        <Link to="/customers" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Customers</Link>
      </div>
    );
  }
  if (!customer) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const toggleBlocked = async () => {
    try {
      await liveCustomers.setBlocked(customer.id, customer.status !== 'blocked');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const savePhone = async () => {
    if (!newPhone.trim()) return;
    setPhoneSaving(true);
    setPhoneErr('');
    try {
      await liveCustomers.updatePhone(customer.id, newPhone.trim());
      setChangingPhone(false);
      setNewPhone('');
      load();
    } catch (e) {
      setPhoneErr(e instanceof LiveApiError ? e.message : 'Failed to update number');
    } finally {
      setPhoneSaving(false);
    }
  };

  const totalPaid = history.filter((b) => b.status !== 'refunded').reduce((a, b) => a + b.total, 0);

  return (
    <div className="stack fade" style={{ maxWidth: 800, gap: 14 }}>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/customers" style={{ fontSize: 13 }}>← Customers</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{customer.name || customer.phone} {customer.verified && '✓'}</h1>
        {!customer.name && <span className="tag">No profile</span>}
        <Tag {...CUSTOMER_STATUS[customer.status]} />
        <div style={{ flex: 1 }} />
        {customer.phone ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.open(waLink(customer.phone, `Hey${customer.name ? ' ' + customer.name.split(' ')[0] : ''}, this is the Prebooze team 👋`), '_blank', 'noopener')}
          >
            💬 WhatsApp
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" disabled title="No phone number on file">💬 WhatsApp</button>
        )}
        <button className="btn btn-danger btn-sm" onClick={toggleBlocked}>
          {customer.status === 'blocked' ? 'Unblock customer' : 'Block customer'}
        </button>
      </div>
      <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span>
          {customer.city || '—'} · {customer.gender || '—'}
          {customer.phone && <> · {customer.phone}</>}
          {customer.email && <> · {customer.email}</>}
        </span>
        {!changingPhone && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setChangingPhone(true); setNewPhone(''); setPhoneErr(''); }}>
            Change login number
          </button>
        )}
      </div>

      {changingPhone && (
        <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
          <div className="tiny hint">
            No OTP round-trip — this directly changes what number they log in with, same trust level as any other admin edit here. Use it when the account is genuinely locked out of its old number (a self-serve change happens from their own Settings once they can log in).
          </div>
          <div className="field">
            <label>New login number</label>
            <input className="input" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="10-digit number" inputMode="tel" autoFocus />
          </div>
          {phoneErr && <div className="tiny" style={{ color: 'var(--red)' }}>{phoneErr}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-pri btn-sm" disabled={phoneSaving || !newPhone.trim()} onClick={savePhone}>
              {phoneSaving ? 'Saving…' : 'Save new number'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={phoneSaving} onClick={() => setChangingPhone(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <Kpi label="Bookings" value={customer.bookings || history.length} />
        <Kpi label="Total spend" value={`₹${fmt(customer.spend)}`} />
        <Kpi label="Paid on record" value={`₹${fmt(totalPaid)}`} />
        <Kpi label="Status" value={CUSTOMER_STATUS[customer.status].label} />
      </div>

      {/* Full profile — admin-only (see BACKEND.md: organizers only ever see
          the basic name/gender/whatsapp a Booking's guest list carries). */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Full profile</div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, fontSize: 13 }}>
          <div><span className="muted tiny">Date of birth</span><div>{customer.dob || '—'}</div></div>
          <div><span className="muted tiny">Profession</span><div>{customer.profession || '—'}</div></div>
          <div><span className="muted tiny">Languages</span><div>{customer.languages || '—'}</div></div>
          <div><span className="muted tiny">State</span><div>{customer.state || '—'}</div></div>
          <div><span className="muted tiny">Country</span><div>{customer.country || '—'}</div></div>
          <div><span className="muted tiny">Pincode</span><div>{customer.pincode || '—'}</div></div>
          <div><span className="muted tiny">Phone verified</span><div>{customer.phoneVerified ? 'Yes' : 'No'}</div></div>
          <div><span className="muted tiny">ID verified</span><div>{customer.idVerified ? 'Yes' : 'No'}</div></div>
          <div><span className="muted tiny">Profile complete</span><div>{customer.profilePct}%</div></div>
          <div><span className="muted tiny">Joined</span><div>{customer.joined}</div></div>
        </div>
        {customer.bio && (
          <div>
            <span className="muted tiny">Bio</span>
            <div className="small" dangerouslySetInnerHTML={{ __html: customer.bio }} />
          </div>
        )}
        {customer.interests.length > 0 && (
          <div>
            <span className="muted tiny">Interests</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {customer.interests.map((i) => <Tag key={i} label={i} cls="tag-dim" />)}
            </div>
          </div>
        )}
        {Object.entries(customer.socialLinks).some(([, v]) => v) && (
          <div>
            <span className="muted tiny">Social links</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              {Object.entries(customer.socialLinks).filter(([, v]) => v).map(([k, v]) => (
                <a key={k} href={/^https?:\/\//.test(v) ? v : `https://${v}`} target="_blank" rel="noopener noreferrer" className="small">
                  {SOCIAL_LABELS[k] ?? k}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="tblwrap">
        <div className="display" style={{ fontWeight: 700, padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          Booking history
        </div>
        <div className="thead" style={{ minWidth: 520 }}>
          <span style={{ flex: 1 }}>#ID</span>
          <span style={{ flex: 1.8 }}>Event</span>
          <span style={{ flex: 1 }}>Qty · Amount</span>
          <span style={{ flex: 1 }}>Status</span>
        </div>
        {history.map((b) => (
          <Link key={b.id} to={`/bookings/${encodeURIComponent(b.id)}`} className="trow clickable" style={{ minWidth: 520, textDecoration: 'none' }}>
            <span style={{ flex: 1, fontWeight: 700 }}>{b.id}</span>
            <span style={{ flex: 1.8 }} className="muted">{b.event.title}</span>
            <span style={{ flex: 1 }}>{b.qty} · ₹{fmt(b.total)}</span>
            <span style={{ flex: 1 }}><Tag {...STATUS_TAG[b.status]} /></span>
          </Link>
        ))}
        {history.length === 0 && !loading && <div className="trow muted">No bookings on record yet.</div>}
      </div>
      <div className="tiny hint">click a booking row to open its full detail, fee breakdown and refund actions</div>
    </div>
  );
}
