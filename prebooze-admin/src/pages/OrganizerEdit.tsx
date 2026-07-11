import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { ORGANIZER_STATUS, Tag } from '../components/ui';
import SeoFields, { emptySeo } from '../components/SeoFields';

/** Edit organizer — mirrors the organizer onboarding flow: business profile then KYC & bank. */
export default function OrganizerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organizers, updateOrganizer, toast } = useAdmin();
  const org = organizers.find((o) => o.id === id);

  const [form, setForm] = useState(() => ({
    name: org?.name ?? '',
    contactPerson: org?.contactPerson ?? '',
    contact: org?.contact ?? '',
    phone: org?.phone ?? '',
    city: org?.city ?? '',
    eventTypes: org?.eventTypes ?? '',
    about: org?.about ?? '',
    links: org?.links ?? '',
    gstin: org?.gstin ?? '',
    pan: org?.pan ?? '',
  }));
  const [logo, setLogo] = useState(true);
  const [aadhaar, setAadhaar] = useState(org?.kyc === 'verified');
  const [seo, setSeo] = useState(org?.seo ?? emptySeo());
  const [bank, setBank] = useState(org?.bankLast4 ?? '');
  const [ifsc, setIfsc] = useState(org?.bankLast4 ? 'HDFC0001234' : '');

  if (!org) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Organizer not found</h1>
        <Link to="/organizers" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Organizers</Link>
      </div>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Organizer name is required');
      return;
    }
    updateOrganizer(org.id, {
      ...form,
      name: form.name.trim(),
      kyc: aadhaar && bank ? 'verified' : org.kyc,
      bankLast4: bank ? bank.slice(-4) : org.bankLast4,
      seo,
    });
    navigate(`/organizers/${org.id}`);
  };

  return (
    <form className="stack fade" style={{ maxWidth: 560, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/organizers/${org.id}`} style={{ fontSize: 13 }}>← {org.name}</Link>
        <h1 className="page-title">Edit organizer</h1>
        <Tag {...ORGANIZER_STATUS[org.status]} />
      </div>

      {/* Step 1 — business profile (same fields as onboarding) */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>1 · Business profile</div>
        <button
          type="button"
          className="dashed-box"
          style={{ background: 'none', textAlign: 'left', cursor: 'pointer', color: logo ? 'var(--green)' : 'var(--muted)', fontSize: 11.5 }}
          onClick={() => setLogo((v) => !v)}
        >
          {logo ? '✓ Brand logo uploaded — shown on every event' : '+ upload brand logo'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Organizer / brand name</label>
            <input className="input" value={form.name} onChange={set('name')} />
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
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>City</label>
            <input className="input" value={form.city} onChange={set('city')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Event types hosted</label>
            <input className="input" value={form.eventTypes} onChange={set('eventTypes')} placeholder="Concerts, Festivals…" />
          </div>
        </div>
        <div className="field">
          <label>About the brand</label>
          <textarea className="input" style={{ minHeight: 60, resize: 'vertical' }} value={form.about} onChange={set('about')} />
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

      {/* Step 2 — KYC & bank (same as onboarding) */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>2 · KYC &amp; bank for payouts</div>
        <button
          type="button"
          className="dashed-box"
          style={{ background: 'none', textAlign: 'left', cursor: 'pointer', color: aadhaar ? 'var(--green)' : 'var(--muted)', fontSize: 11.5 }}
          onClick={() => setAadhaar((v) => !v)}
        >
          {aadhaar ? '✓ Aadhaar + selfie verified with UIDAI' : '+ upload Aadhaar front + capture selfie'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Bank account number</label>
            <input className="input" value={bank} onChange={(e) => setBank(e.target.value)} inputMode="numeric" placeholder={org.bankLast4 ? `•••• ${org.bankLast4}` : 'Account number'} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>IFSC code</label>
            <input className="input" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
          </div>
        </div>
        {bank && ifsc && <div className="small green">✓ penny-drop verification passed</div>}
        <div className="tiny hint">KYC status: {org.kyc} · changing bank details re-triggers penny-drop verification</div>
      </div>

      <SeoFields
        seo={seo}
        onChange={setSeo}
        slug={'/organizers/' + form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
        fallbackTitle={`${form.name || 'Organizer'} — events & tickets`}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>Save organizer</button>
        <Link to={`/organizers/${org.id}`} className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
