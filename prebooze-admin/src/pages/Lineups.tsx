import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { CityFilterDropdown, GradientPhoto, ImagePicker, SearchBox, Tag } from '../components/ui';
import { enabledCityNames } from '../store/data';
import WysiwygEditor from '../components/WysiwygEditor';

/** Line-ups directory — artists, DJs, bands, sponsors, promoters and hosts
 * that events can book and guests can follow. */
export function Lineups() {
  const { lineups, lineupCategories, events, locations } = useAdmin();
  const navigate = useNavigate();
  const [cat, setCat] = useState('All');
  const [cityF, setCityF] = useState('All');
  const [query, setQuery] = useState('');
  const cities = enabledCityNames(locations);

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

  const eventCount = (name: string) =>
    events.filter((e) => (e.lineup ?? '').toLowerCase().includes(name.toLowerCase())).length +
    (name === 'DJ Nova' || name === 'The Wilds' ? 2 : name === 'FizzCo' || name === 'CityBeat' ? 1 : 0);

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <div className="page-hd">
        <h1 className="page-title">Line-ups</h1>
        <Link to="/lineups/new" className="btn btn-pri">+ Add line-up</Link>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search artists, sponsors…" style={{ flex: 1, minWidth: 180 }} />
        {['All', ...lineupCategories].map((c) => (
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
              <GradientPhoto seed={l.name.charCodeAt(0) * 5} style={{ width: 30, height: 30, borderRadius: '50%', flex: 'none', padding: 0 }} />
              {l.name} {l.verified && '✓'}
            </span>
            <span style={{ flex: 1 }}><Tag label={l.category} cls={['Artist', 'DJ', 'Band', 'Comedian'].includes(l.category) ? 'tag-green' : ''} /></span>
            <span style={{ flex: 1 }} className="muted">{l.city ?? '—'}</span>
            <span style={{ flex: 1 }}>{fmt(l.followers)}</span>
            <span style={{ flex: 1 }}>{eventCount(l.name)}</span>
            <span style={{ flex: 1 }}>{l.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Unverified" cls="" />}</span>
          </div>
        ))}
        {list.length === 0 && <div className="trow muted">No line-ups match.</div>}
      </div>
      <div className="tiny hint">
        line-ups appear as chips on event pages and as followable profiles on the guest site · click a row to edit
      </div>
    </div>
  );
}

/** Add / edit a line-up profile — title, description, image, social links and category. */
export function LineupEdit() {
  const { id } = useParams(); // undefined = create
  const isCreate = !id;
  const navigate = useNavigate();
  const { lineups, lineupCategories, addLineup, updateLineup, removeLineup, addLineupCategory, toast } = useAdmin();
  const existing = isCreate ? undefined : lineups.find((l) => l.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? lineupCategories[0]);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [links, setLinks] = useState(existing?.links ?? '');
  const [imageDataUrl, setImageDataUrl] = useState(existing?.imageDataUrl ?? '');
  const hasImage = !!imageDataUrl;
  const [verified, setVerified] = useState(existing?.verified ?? false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState('');

  if (!isCreate && !existing) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Line-up not found</h1>
        <Link to="/lineups" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Line-ups</Link>
      </div>
    );
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Name / title is required');
      return;
    }
    if (!description.trim()) {
      toast('Add a short description — it shows on their profile');
      return;
    }
    const patch = {
      name: name.trim(),
      category,
      description: description.trim(),
      city: city.trim() || undefined,
      links: links.trim() || undefined,
      hasImage,
      imageDataUrl,
      verified,
    };
    if (isCreate) addLineup({ id: 'lu' + Date.now(), followers: 0, ...patch });
    else updateLineup(existing!.id, patch);
    navigate('/lineups');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 560, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/lineups" style={{ fontSize: 13 }}>← Line-ups</Link>
        <h1 className="page-title">{isCreate ? 'Add line-up' : `Edit — ${existing!.name}`}</h1>
        <div style={{ flex: 1 }} />
        {!isCreate && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('Remove this line-up? Event pages lose the chip link.')) {
                removeLineup(existing!.id);
                navigate('/lineups');
              }
            }}
          >
            Remove
          </button>
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <ImagePicker value={imageDataUrl} onChange={setImageDataUrl} width={76} height={76} radius="50%" label="+ photo">
            <span style={{ margin: 'auto', fontSize: 16 }}>✓</span>
          </ImagePicker>
          <div className="field" style={{ flex: 1 }}>
            <label>Name / title</label>
            <input className="input" style={{ fontSize: 15, fontWeight: 700 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DJ Nova" autoFocus={isCreate} />
          </div>
        </div>

        <div className="field">
          <label>Line-up category</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {lineupCategories.map((c) => (
              <button key={c} type="button" className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{c}</button>
            ))}
            {!showNewCat ? (
              <button type="button" className="chip" onClick={() => setShowNewCat(true)}>+ new</button>
            ) : (
              <>
                <input className="input" style={{ width: 130, padding: '5px 10px', fontSize: 12 }} value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category" autoFocus />
                <button
                  type="button"
                  className="btn btn-pri btn-sm"
                  onClick={() => {
                    if (!newCat.trim()) return;
                    addLineupCategory(newCat.trim());
                    setCategory(newCat.trim());
                    setNewCat('');
                    setShowNewCat(false);
                  }}
                >
                  Add
                </button>
              </>
            )}
          </div>
        </div>

        <div className="field">
          <label>Description — shows on their public profile</label>
          <WysiwygEditor value={description} onChange={setDescription} minHeight={72} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>City</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1.4 }}>
            <label>Social media links</label>
            <input className="input" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="ig/… · x/… · spotify/…" />
          </div>
        </div>
        <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={verified} onChange={() => setVerified((v) => !v)} style={{ accentColor: 'var(--green)' }} />
          Verified line-up ✓ (identity checked by admin)
        </label>
      </div>

      <div className="tiny hint">appears in event editors' line-up pickers and as a followable profile on the guest site</div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>{isCreate ? 'Create line-up ✓' : 'Save line-up'}</button>
        <Link to="/lineups" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
