import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LiveLocationPicker, Tag } from '../components/ui';
import SeoFields, { emptySeo } from '../components/SeoFields';
import WysiwygEditor from '../components/WysiwygEditor';
import { liveOrganizers, LiveApiError, type LiveOrganizer } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import type { Seo } from '../types';

const TITLE = 'Edit organizer';

/** Edit organizer — real Organizer row (business profile + compliance
 * fields). Bank/KYC docs upload stays a mock toggle here (no real bank
 * verification/penny-drop backend exists yet); the account number itself,
 * if entered, is genuinely saved as bankLast4. */
export default function OrganizerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [org, setOrg] = useState<LiveOrganizer | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [form, setForm] = useState({
    brandName: '', contactPerson: '', contact: '', phone: '', eventTypes: '', about: '', links: '', gstin: '', pan: '', pincode: '',
  });
  const [loc, setLoc] = useState({ country: 'India', state: '', city: '' });
  const [seo, setSeo] = useState<Seo>(emptySeo());
  const [bank, setBank] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveOrganizers
      .list()
      .then((orgs) => {
        const o = orgs.find((x) => x.id === id);
        setOrg(o ?? null);
        if (o) {
          setForm({
            brandName: o.brandName, contactPerson: o.contactPerson ?? '', contact: o.contact ?? '', phone: o.phone ?? '',
            eventTypes: o.eventTypes ?? '', about: o.about ?? '', links: o.links ?? '', gstin: o.gstin ?? '', pan: o.pan ?? '', pincode: o.pincode ?? '',
          });
          setLoc({ country: o.country ?? 'India', state: o.state ?? '', city: o.city });
          setSeo((o.seo as Seo | null) ?? emptySeo());
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, id]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!loading && !org) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Organizer not found</h1>
        <Link to="/organizers" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Organizers</Link>
      </div>
    );
  }
  if (!org) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandName.trim()) { setErr('Organizer name is required'); return; }
    if (!loc.city.trim()) { setErr('Pick a city'); return; }
    try {
      await liveOrganizers.update(org.id, {
        ...form,
        brandName: form.brandName.trim(),
        city: loc.city, state: loc.state || undefined, country: loc.country || undefined,
        bankLast4: bank ? bank.slice(-4) : org.bankLast4 ?? undefined,
        seo,
      });
      navigate(`/organizers/${org.id}`);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 560, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/organizers/${org.id}`} style={{ fontSize: 13 }}>← {org.brandName}</Link>
        <h1 className="page-title">Edit organizer</h1>
        {org.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Unverified" cls="" />}
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Business profile</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Organizer / brand name</label>
            <input className="input" value={form.brandName} onChange={set('brandName')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Contact person</label>
            <input className="input" value={form.contactPerson} onChange={set('contactPerson')} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Email</label>
            <input className="input" value={form.contact} onChange={set('contact')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Phone / WhatsApp</label>
            <input className="input" value={form.phone} onChange={set('phone')} />
          </div>
        </div>
        <LiveLocationPicker value={loc} onChange={setLoc} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Pincode</label>
            <input className="input" value={form.pincode} onChange={set('pincode')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Event types hosted</label>
            <input className="input" value={form.eventTypes} onChange={set('eventTypes')} placeholder="Concerts, Festivals…" />
          </div>
        </div>
        <div className="field">
          <label>About the brand</label>
          <WysiwygEditor value={form.about} onChange={(html) => setForm((f) => ({ ...f, about: html }))} minHeight={60} />
        </div>
        <div className="field">
          <label>Website & social links</label>
          <input className="input" value={form.links} onChange={set('links')} placeholder="site / ig / X" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>GSTIN (optional)</label>
            <input className="input" value={form.gstin} onChange={set('gstin')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>PAN number</label>
            <input className="input" value={form.pan} onChange={set('pan')} />
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Bank for payouts</div>
        <div className="field">
          <label>Bank account number</label>
          <input className="input" value={bank} onChange={(e) => setBank(e.target.value)} inputMode="numeric" placeholder={org.bankLast4 ? `•••• ${org.bankLast4}` : 'Account number'} />
        </div>
        <div className="tiny hint">only the last 4 digits are stored · leave blank to keep the current details</div>
      </div>

      <SeoFields
        seo={seo}
        onChange={setSeo}
        slug={'/organizers/' + form.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
        fallbackTitle={`${form.brandName || 'Organizer'} — events & tickets`}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>Save organizer</button>
        <Link to={`/organizers/${org.id}`} className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
