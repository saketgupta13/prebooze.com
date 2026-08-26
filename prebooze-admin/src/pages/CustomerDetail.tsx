import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CUSTOMER_STATUS, Kpi, Tag, LiveLocationPicker } from '../components/ui';
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
const emptyEditForm = {
  name: '', email: '', city: '', state: '', country: '', pincode: '', dob: '', gender: '', profession: '', languages: '', bio: '',
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [customer, setCustomer] = useState<LiveCustomerDetail | null>(null);
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const startEdit = () => {
    setForm({
      name: customer.name, email: customer.email ?? '', city: customer.city, state: customer.state ?? '',
      country: customer.country ?? '', pincode: customer.pincode ?? '', dob: customer.dob ?? '', gender: customer.gender ?? '',
      profession: customer.profession ?? '', languages: customer.languages ?? '', bio: customer.bio ?? '',
    });
    setEditing(true);
    setErr('');
  };

  const saveEdit = async () => {
    setSaving(true);
    setErr('');
    try {
      await liveCustomers.update(customer.id, form);
      setEditing(false);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async () => {
    if (!window.confirm(`Permanently delete ${customer.name || customer.phone}? This can't be undone.`)) return;
    setDeleting(true);
    setErr('');
    try {
      await liveCustomers.remove(customer.id);
      navigate('/customers');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to delete');
      setDeleting(false);
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
        {!editing && (
          <button className="btn btn-ghost btn-sm" onClick={startEdit}>
            ✎ Edit
          </button>
        )}
        <button className="btn btn-danger btn-sm" onClick={toggleBlocked}>
          {customer.status === 'blocked' ? 'Unblock customer' : 'Block customer'}
        </button>
        <button className="btn btn-danger btn-sm" disabled={deleting} onClick={deleteCustomer}>
          {deleting ? 'Deleting…' : '🗑 Delete'}
        </button>
      </div>
      <div className="small muted">
        {customer.city || '—'} · {customer.gender || '—'}
        {customer.phone && <> · {customer.phone}</>}
        {customer.email && <> · {customer.email}</>}
      </div>

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
        {editing ? (
          <>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              <div className="field">
                <label>Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label>Date of birth</label>
                <input className="input" type="date" value={form.dob} onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))} />
              </div>
              <div className="field">
                <label>Gender</label>
                <select className="input" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                  <option value="">Select…</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Non-binary</option>
                  <option>Prefer not to say</option>
                </select>
              </div>
              <div className="field">
                <label>Pincode</label>
                <input className="input" value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} />
              </div>
              <div className="field">
                <label>Profession</label>
                <input className="input" value={form.profession} onChange={(e) => setForm((f) => ({ ...f, profession: e.target.value }))} />
              </div>
              <div className="field">
                <label>Languages</label>
                <input className="input" value={form.languages} onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))} />
              </div>
            </div>
            <LiveLocationPicker
              value={{ country: form.country, state: form.state, city: form.city }}
              onChange={(v) => setForm((f) => ({ ...f, ...v }))}
            />
            <div className="field">
              <label>Bio</label>
              <textarea className="input" rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-pri btn-sm" disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, fontSize: 13 }}>
            <div><span className="muted tiny">Date of birth</span><div>{customer.dob || '—'}</div></div>
            <div><span className="muted tiny">Age</span><div>{customer.age ?? '—'}</div></div>
            <div><span className="muted tiny">Gender</span><div>{customer.gender || '—'}</div></div>
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
        )}
        {!editing && customer.bio && (
          <div>
            <span className="muted tiny">Bio</span>
            <div className="small" dangerouslySetInnerHTML={{ __html: customer.bio }} />
          </div>
        )}
        {!editing && customer.interests.length > 0 && (
          <div>
            <span className="muted tiny">Interests</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {customer.interests.map((i) => <Tag key={i} label={i} cls="tag-dim" />)}
            </div>
          </div>
        )}
        {!editing && Object.entries(customer.socialLinks).some(([, v]) => v) && (
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
