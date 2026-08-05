import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import WysiwygEditor from '../components/WysiwygEditor';
import RealImageUpload from '../components/RealImageUpload';
import SeoFields, { emptySeo } from '../components/SeoFields';
import { livePromoters, LiveApiError, type LivePromoter } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import type { Seo } from '../types';

const TITLE = 'Edit promoter';

/** Edit an existing promoter's profile — real Promoter row. */
export default function PromoterEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [p, setP] = useState<LivePromoter | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [seo, setSeo] = useState<Seo>(emptySeo());

  const load = () => {
    setLoading(true);
    setErr('');
    livePromoters
      .list()
      .then((promoters) => {
        const found = promoters.find((x) => x.id === id);
        setP(found ?? null);
        if (found) {
          setName(found.name);
          setContact(found.contact ?? '');
          setCity(found.city);
          setBio(found.bio ?? '');
          setLogoUrl(found.logoUrl ?? null);
          setSeo((found.seo as Seo | null) ?? emptySeo());
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, id]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!loading && !p) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Promoter not found</h1>
        <Link to="/promoters" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Promoters</Link>
      </div>
    );
  }
  if (!p) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Name is required'); return; }
    try {
      await livePromoters.update(p.id, { name: name.trim(), contact: contact.trim(), city: city.trim() || '—', bio: bio.trim(), logoUrl: logoUrl ?? undefined, seo });
      navigate(`/promoters/${p.id}`);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 560, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/promoters/${p.id}`} style={{ fontSize: 13 }}>← {p.name}</Link>
        <h1 className="page-title">Edit promoter</h1>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={save}>
        <RealImageUpload value={logoUrl} onChange={setLogoUrl} height={90} width={90} label="photo" />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Promoter / PR name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Contact email / phone</label>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>City</label>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="field">
          <label>Bio</label>
          <WysiwygEditor value={bio} onChange={setBio} minHeight={56} />
        </div>

        <SeoFields
          seo={seo}
          onChange={setSeo}
          slug={'/promoters/' + p.id}
          fallbackTitle={`${name || 'Promoter'} — guest lists & events`}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <Link to={`/promoters/${p.id}`} className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-pri" style={{ flex: 1, padding: 10 }}>Save changes</button>
        </div>
      </form>
    </div>
  );
}
