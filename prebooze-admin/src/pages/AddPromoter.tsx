import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WysiwygEditor from '../components/WysiwygEditor';
import { livePromoters, LiveApiError } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

const TITLE = 'Add promoter';

/** Add promoter — admin onboards a PR directly as an already-approved
 * Promoter row (self-serve promoter KYC applications go through
 * Verifications instead). */
export default function AddPromoter() {
  const session = useLiveSession();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) { setErr('Promoter name and contact are required'); return; }
    setSaving(true);
    setErr('');
    try {
      const created = await livePromoters.create({ name: name.trim(), contact: contact.trim(), city: city.trim() || undefined });
      if (bio.trim()) await livePromoters.update(created.id, { bio: bio.trim() });
      navigate(`/promoters/${created.id}`);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add promoter');
      setSaving(false);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 560, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/promoters" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Promoters</Link>
        <h1 className="page-title">Add promoter</h1>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={submit}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Promoter / PR name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Nova Nights" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Contact email / phone</label>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="hey@brand.co" />
          </div>
        </div>
        <div className="field">
          <label>City</label>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" />
        </div>
        <div className="field">
          <label>Bio</label>
          <WysiwygEditor value={bio} onChange={setBio} minHeight={56} />
        </div>

        <button type="submit" className="btn btn-pri" style={{ padding: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={saving}>
          {saving ? 'Saving…' : <>Add promoter <CheckCircle2 size={14} /></>}
        </button>
      </form>
    </div>
  );
}
