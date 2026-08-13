import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WysiwygEditor from '../components/WysiwygEditor';
import { LiveLocationPicker } from '../components/ui';
import { SocialLinksEditor } from './OrganizerEdit';
import { liveOrganizers, LiveApiError } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Add organizer';

/** Add organizer — admin onboards a brand directly as an already-approved
 * Organizer catalog row (self-serve organizer KYC applications go through
 * Verifications instead, see KycService.approve). */
export default function AddOrganizer() {
  const session = useLiveSession();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [loc, setLoc] = useState({ country: 'India', state: '', city: '' });
  const [pincode, setPincode] = useState('');
  const [eventTypes, setEventTypes] = useState('Concerts');
  const [about, setAbout] = useState('');
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; facebook?: string; other?: string[] } | null>(null);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) { setErr('Brand name and contact email are required'); return; }
    if (!loc.city.trim()) { setErr('Pick a city'); return; }
    setSaving(true);
    setErr('');
    try {
      const created = await liveOrganizers.create({
        brandName: name.trim(), city: loc.city, state: loc.state || undefined, country: loc.country || undefined, pincode: pincode.trim() || undefined,
        contact: contact.trim(),
      });
      await liveOrganizers.update(created.id, {
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        eventTypes,
        about: about.trim() || undefined,
        socialLinks: socialLinks ?? undefined,
      });
      navigate(`/organizers/${created.id}`);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add organizer');
      setSaving(false);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 560, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/organizers" style={{ fontSize: 13 }}>← Organizers</Link>
        <h1 className="page-title">Add organizer — business profile</h1>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={submit}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Organizer / brand name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Contact person</label>
            <input className="input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Contact email</label>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Phone / WhatsApp</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <LiveLocationPicker value={loc} onChange={setLoc} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Pincode</label>
            <input className="input" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Event types hosted</label>
            <select className="input" value={eventTypes} onChange={(e) => setEventTypes(e.target.value)}>
              <option>Concerts</option>
              <option>Comedy</option>
              <option>Festivals</option>
              <option>Club nights</option>
              <option>Mixed</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>About the brand</label>
          <WysiwygEditor value={about} onChange={setAbout} minHeight={56} />
        </div>
        <div className="field">
          <label>Social links</label>
          <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />
        </div>
        <div className="tiny hint">PAN/GSTIN/bank details are added later by the organizer themselves (Settings → Payment profiles), or by staff on their behalf via Edit organizer once this row exists.</div>
        <button type="submit" className="btn btn-pri" style={{ padding: 10 }} disabled={saving}>{saving ? 'Saving…' : 'Save organizer ✓'}</button>
      </form>
    </div>
  );
}
