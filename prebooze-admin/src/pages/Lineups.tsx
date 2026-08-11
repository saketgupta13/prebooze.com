import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fmt } from '../store/data';
import { CityFilterDropdown, GradientPhoto, LiveLocationPicker, SearchBox, Tag } from '../components/ui';
import WysiwygEditor from '../components/WysiwygEditor';
import RealImageUpload from '../components/RealImageUpload';
import SeoFields, { emptySeo } from '../components/SeoFields';
import { liveLineups, LiveApiError, type LiveLineup } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import PlansAndSubscribers from '../components/PlansAndSubscribers';
import type { Seo } from '../types';

const CATEGORIES = ['Artist', 'DJ', 'Band', 'Comedian', 'Sponsor', 'Promoter', 'Host'];
const EMOJI: Record<string, string> = { DJ: '🎧', Band: '🎸', Comedian: '🎤', Artist: '🎨', Sponsor: '⭐', Promoter: '📣', Host: '🎙' };

/** Line-ups directory — real Lineup catalog rows (artists, DJs, bands,
 * sponsors, promoters, hosts). Already-approved only — pending self-serve
 * applications are reviewed under Verifications. A real logo (logoUrl,
 * uploaded via RealImageUpload below) falls back to the hue/emoji gradient
 * placeholder when unset — same pattern as Venues/Promoters. */
export function Lineups() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();
  const [lineups, setLineups] = useState<LiveLineup[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [cat, setCat] = useState('All');
  const [cityF, setCityF] = useState('All');
  const [query, setQuery] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveLineups.list().then(setLineups).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const cities = useMemo(() => [...new Set(lineups.map((l) => l.city).filter(Boolean))].sort(), [lineups]);

  const list = useMemo(() => {
    let l = lineups;
    if (cat !== 'All') l = l.filter((x) => x.category === cat);
    if (cityF !== 'All') l = l.filter((x) => x.city === cityF);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((x) => x.name.toLowerCase().includes(q));
    }
    return l;
  }, [lineups, cat, cityF, query]);

  const gate = useLiveGate('Line-ups', session);
  if (gate) return gate;

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <LiveHeaderBar title="Line-ups" session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Line-ups</h1>
        <Link to="/lineups/new" className="btn btn-pri">+ Add line-up</Link>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search artists, sponsors…" style={{ flex: 1, minWidth: 180 }} />
        {['All', ...CATEGORIES].map((c) => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
        <CityFilterDropdown value={cityF} onChange={setCityF} cities={cities} />
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 640 }}>
          <span style={{ flex: 2 }}>Name</span>
          <span style={{ flex: 1 }}>Category</span>
          <span style={{ flex: 1 }}>City</span>
          <span style={{ flex: 1 }}>Followers</span>
          <span style={{ flex: 1 }}>Events</span>
          <span style={{ flex: 1 }}>Status</span>
        </div>
        {list.map((l) => (
          <div key={l.id} className="trow clickable" style={{ minWidth: 640 }} onClick={() => navigate(`/lineups/${l.id}/edit`)}>
            <span style={{ flex: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              {l.logoUrl ? (
                <img src={l.logoUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', flex: 'none', objectFit: 'cover' }} />
              ) : (
                <GradientPhoto seed={l.hue} style={{ width: 30, height: 30, borderRadius: '50%', flex: 'none', padding: 0 }} />
              )}
              {l.name} {l.verified && '✓'}
            </span>
            <span style={{ flex: 1 }}><Tag label={l.category} cls={['Artist', 'DJ', 'Band', 'Comedian'].includes(l.category) ? 'tag-green' : ''} /></span>
            <span style={{ flex: 1 }} className="muted">{l.city || '—'}</span>
            <span style={{ flex: 1 }}>{fmt(l.followers)}</span>
            <span style={{ flex: 1 }}>{l.eventsPlayed}</span>
            <span style={{ flex: 1 }}>{l.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Unverified" cls="" />}</span>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="trow muted">No line-ups match.</div>}
      </div>
      <div className="tiny hint">
        line-ups appear as chips on event pages and as followable profiles on the guest site · click a row to edit
      </div>

      <PlansAndSubscribers role="lineup" roleLabel="Line-up" />
    </div>
  );
}

/** Add / edit a line-up profile — real Lineup row. */
export function LineupEdit() {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [existing, setExisting] = useState<LiveLineup | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [loc, setLoc] = useState({ country: 'India', state: '', city: '' });
  const [pincode, setPincode] = useState('');
  const [links, setLinks] = useState('');
  const [verified, setVerified] = useState(false);
  const [seo, setSeo] = useState<Seo>(emptySeo());

  const load = () => {
    if (isCreate) return;
    setLoading(true);
    setErr('');
    liveLineups
      .list()
      .then((lineups) => {
        const l = lineups.find((x) => x.id === id);
        setExisting(l ?? null);
        if (l) {
          setName(l.name);
          setUsername(l.slug);
          setLogoUrl(l.logoUrl ?? null);
          setCategory(l.category);
          setDescription(l.bio ?? '');
          setLoc({ country: l.country ?? 'India', state: l.state ?? '', city: l.city ?? '' });
          setPincode(l.pincode ?? '');
          setLinks((l.links ?? []).join(' · '));
          setVerified(l.verified);
          setSeo((l.seo as Seo | null) ?? emptySeo());
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, id]);

  const gate = useLiveGate('Edit line-up', session);
  if (gate) return gate;

  if (!isCreate && !loading && !existing) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Line-up not found</h1>
        <Link to="/lineups" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Line-ups</Link>
      </div>
    );
  }
  if (!isCreate && !existing) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Name / title is required'); return; }
    if (!description.trim()) { setErr("Add a short description — it shows on their profile"); return; }
    const linksArr = links.split('·').map((s) => s.trim()).filter(Boolean);
    try {
      if (isCreate) {
        const created = await liveLineups.create({ name: name.trim(), category, city: loc.city || undefined, state: loc.state || undefined, country: loc.country || undefined, pincode: pincode.trim() || undefined });
        await liveLineups.update(created.id, {
          bio: description.trim(), links: linksArr, seo, logoUrl,
          slug: username.trim() || undefined,
        });
        if (verified) await liveLineups.setVerified(created.id, true);
      } else {
        await liveLineups.update(existing!.id, {
          name: name.trim(), category, bio: description.trim(), city: loc.city || undefined, links: linksArr,
          emoji: EMOJI[category] ?? existing!.emoji, seo, logoUrl,
          slug: username.trim() || undefined, state: loc.state || undefined, country: loc.country || undefined, pincode: pincode.trim() || undefined,
        });
        if (verified !== existing!.verified) await liveLineups.setVerified(existing!.id, verified);
      }
      navigate('/lineups');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 560, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/lineups" style={{ fontSize: 13 }}>← Line-ups</Link>
        <h1 className="page-title">{isCreate ? 'Add line-up' : `Edit — ${existing!.name}`}</h1>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <RealImageUpload value={logoUrl} onChange={setLogoUrl} height={76} width={76} label="logo" />
          <div className="field" style={{ flex: 1 }}>
            <label>Name / title</label>
            <input className="input" style={{ fontSize: 15, fontWeight: 700 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DJ Nova" autoFocus={isCreate} />
          </div>
        </div>

        <div className="field">
          <label>Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. dj-nova — their profile URL" />
        </div>

        <div className="field">
          <label>Line-up category</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Description — shows on their public profile</label>
          <WysiwygEditor value={description} onChange={setDescription} minHeight={72} />
        </div>
        <LiveLocationPicker value={loc} onChange={setLoc} />
        <div className="field">
          <label>Pincode</label>
          <input className="input" value={pincode} onChange={(e) => setPincode(e.target.value)} />
        </div>
        <div className="field">
          <label>Social media links</label>
          <input className="input" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="ig/… · x/… · spotify/…" />
        </div>
        <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={verified} onChange={() => setVerified((v) => !v)} style={{ accentColor: 'var(--green)' }} />
          Verified line-up ✓ (identity checked by admin)
        </label>
      </div>

      <SeoFields
        seo={seo}
        onChange={setSeo}
        slug={'/lineups/' + (existing?.id ?? 'new')}
        fallbackTitle={`${name || 'Line-up'} — follow on Prebooze`}
      />

      <div className="tiny hint">appears in event editors' line-up pickers and as a followable profile on the guest site</div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>{isCreate ? 'Create line-up ✓' : 'Save line-up'}</button>
        <Link to="/lineups" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
