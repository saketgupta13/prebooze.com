import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { VENUES, fmtDate, fmtTime } from '../../data/mock';
import type { Event, TicketTier } from '../../types';
import Poster, { categoryEmoji } from '../../components/Poster';
import Accordion from '../../components/Accordion';

const STEPS = ['1 Basics', '2 Tickets', '3 Rules & line-up', '4 SEO & publish'];
const INCLUDE_OPTIONS = ['Entry', 'Welcome drink', 'Food coupon', 'Standing zone', 'Lounge access', '2 drinks', 'Meet & greet'];

interface TierDraft {
  name: string;
  price: string;
  quantity: string;
  includes: string[];
}

export default function CreateEvent() {
  const { user, addEvent } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);

  // Step 1 — basics
  const [banner, setBanner] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Concerts');
  const [ageLimit, setAgeLimit] = useState('18+');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [duration, setDuration] = useState('3');
  const [venueId, setVenueId] = useState(VENUES[0].id);

  // Step 2 — tickets
  const [tiers, setTiers] = useState<TierDraft[]>([
    { name: 'General', price: '29', quantity: '500', includes: ['Entry', 'Welcome drink'] },
  ]);
  const [earlyBird, setEarlyBird] = useState(false);
  const [guestCap, setGuestCap] = useState('10');

  // Step 3 — rules & lineup
  const [conditions, setConditions] = useState('Photo ID required\nNo re-entry');
  const [dressCode, setDressCode] = useState('Smart casual — no flip-flops or sleeveless shirts.');
  const [foodRule, setFoodRule] = useState('Full bar inside. Outside food & drinks not permitted.');
  const [prohibited, setProhibited] = useState('No weapons, illegal substances or professional cameras.');
  const [lineup, setLineup] = useState('DJ Nova (Opening DJ), The Wilds (Headline artist)');

  // Step 4 — SEO
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [seoSlug, setSeoSlug] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');

  const slug = useMemo(
    () =>
      (seoSlug || title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    [seoSlug, title]
  );

  const step1Valid = title.trim() && date && venueId;
  const tiersValid = tiers.every((t) => t.name.trim() && +t.price >= 0 && +t.quantity > 0);

  const buildEvent = (status: Event['status']): Event => ({
    id: 'my-' + Date.now(),
    slug: slug || 'my-event-' + Date.now(),
    title: title.trim() || 'Untitled event',
    description: description.trim(),
    category,
    ageLimit,
    tags: [category === 'Concerts' ? 'Concert' : category, ageLimit],
    date: new Date(`${date}T${time}`).toISOString(),
    durationHrs: +duration,
    venueId,
    organizerId: 'livewire',
    status,
    conditions: conditions.split('\n').filter(Boolean),
    rules: [
      { title: 'Dress code', body: dressCode },
      { title: 'Food & drinks', body: foodRule },
      { title: 'Prohibited items', body: prohibited },
    ],
    lineup: lineup
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const m = s.match(/^(.*?)\s*\((.*?)\)$/);
        return m ? { name: m[1], role: m[2] } : { name: s, role: 'Artist' };
      }),
    tiers: tiers.map(
      (t, i): TicketTier => ({
        id: 't' + (i + 1),
        name: t.name.trim(),
        price: +t.price,
        quantity: +t.quantity,
        sold: 0,
        includes: t.includes,
      })
    ),
    posterHue: (title.length * 47) % 360,
    seo: {
      title: seoTitle || `${title} | tickets`,
      description: seoDesc || description.slice(0, 160),
      slug,
      keywords: seoKeywords.split(',').map((s) => s.trim()).filter(Boolean),
    },
  });

  const saveDraft = () => {
    addEvent(buildEvent('draft'));
    navigate('/organizer/events');
  };

  const submitForApproval = () => {
    addEvent(buildEvent('pending'));
    navigate('/organizer/events');
  };

  const venue = VENUES.find((v) => v.id === venueId)!;

  const setTier = (i: number, patch: Partial<TierDraft>) =>
    setTiers((prev) => prev.map((t, x) => (x === i ? { ...t, ...patch } : t)));

  if (preview) {
    const ev = buildEvent('pending');
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20 }}>👁 Preview — guest view</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setPreview(false)}>
              ✎ Keep editing
            </button>
            <button className="btn btn-pri" onClick={submitForApproval}>
              Submit for approval →
            </button>
          </div>
        </div>

        <div className="card">
          <div className="detail-head">
            <Poster hue={ev.posterHue} emoji={categoryEmoji(ev.category)} label="portrait banner 3:4" />
            <div className="detail-title">
              <h1 style={{ fontSize: 24 }}>{ev.title}</h1>
              <div className="detail-meta">
                <span>📅 {fmtDate(ev.date)}, {fmtTime(ev.date)}</span>
                <span>📍 {venue.name}, {venue.city}</span>
                <span>⏱ {ev.durationHrs} hrs</span>
              </div>
              <div className="chip-row">
                {ev.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
              <div className="small muted" style={{ marginTop: 12 }}>
                Hosted by <span className="bold" style={{ color: 'var(--text)' }}>{user?.orgBrand ?? 'Your brand'}</span>{' '}
                <span className="verified">✓</span> ·{' '}
                {ev.tiers.map((t) => `${t.name} ₹${t.price}`).join(' · ')}
              </div>
            </div>
          </div>
          <p className="muted small">{ev.description || 'No description yet.'}</p>
          {ev.conditions.length > 0 && (
            <ul style={{ paddingLeft: 20, marginTop: 12 }} className="muted small">
              {ev.conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="tiny muted-2" style={{ marginTop: 12 }}>
          After submit: status <span className="badge badge-pending">Pending admin approval</span> →
          goes live on approval
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>
          <Link to="/organizer/events" className="muted">
            ←
          </Link>{' '}
          Create event
        </h1>
        <span className="badge badge-ok">Draft saved ✓</span>
      </div>

      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <button
            key={s}
            className={`ws ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}
            style={{ background: 'none', cursor: 'pointer' }}
            onClick={() => setStep(i)}
          >
            {s}
            {i < step ? ' ✓' : ''}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="card">
          <div
            className={`upload-box ${banner ? 'done' : ''}`}
            onClick={() => setBanner((v) => !v)}
            style={{ marginBottom: 16, padding: 30 }}
          >
            {banner
              ? '✓ Banner uploaded'
              : '⬆ portrait banner · 3:4 · min 900px — shown on cards & event page'}
          </div>
          <div className="field">
            <span>Event title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>
          <div className="field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description — what should guests expect?"
            />
          </div>
          <div className="form-row">
            <div className="field">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Concerts</option>
                <option>Comedy</option>
                <option>Festivals</option>
                <option>This weekend</option>
              </select>
            </div>
            <div className="field">
              <span>Age limit</span>
              <select value={ageLimit} onChange={(e) => setAgeLimit(e.target.value)}>
                <option>All ages</option>
                <option>18+</option>
                <option>21+</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <span>Start</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="field">
              <span>Duration (hrs)</span>
              <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                {['2', '3', '4', '5', '6', '8'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <span>Venue — search or add new 📍</span>
            <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              {VENUES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.locality}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={saveDraft}>
              Save draft
            </button>
            <button className="btn btn-pri" disabled={!step1Valid} onClick={() => setStep(1)}>
              Next: Tickets →
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Ticket tiers</h3>
          {tiers.map((t, i) => (
            <div key={i} className="card" style={{ background: 'var(--surface-2)', marginBottom: 12, padding: 16 }}>
              <div className="form-row">
                <div className="field">
                  <span>Tier name</span>
                  <input value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} />
                </div>
                <div className="field">
                  <span>Price ₹</span>
                  <input
                    value={t.price}
                    onChange={(e) => setTier(i, { price: e.target.value })}
                    inputMode="numeric"
                  />
                </div>
                <div className="field">
                  <span>Qty</span>
                  <input
                    value={t.quantity}
                    onChange={(e) => setTier(i, { quantity: e.target.value })}
                    inputMode="numeric"
                  />
                </div>
                <button
                  className="icon-round"
                  style={{ alignSelf: 'center', flex: '0 0 auto', background: 'none' }}
                  onClick={() => setTiers((prev) => prev.filter((_, x) => x !== i))}
                  disabled={tiers.length === 1}
                  title="Remove tier"
                >
                  ✕
                </button>
              </div>
              <div className="tiny muted" style={{ marginBottom: 6 }}>
                What's included in this ticket:
              </div>
              <div className="chip-row">
                {INCLUDE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    className={`chip ${t.includes.includes(opt) ? 'on' : ''}`}
                    style={{ fontSize: 12, padding: '4px 11px' }}
                    onClick={() =>
                      setTier(i, {
                        includes: t.includes.includes(opt)
                          ? t.includes.filter((x) => x !== opt)
                          : [...t.includes, opt],
                      })
                    }
                  >
                    {opt}
                    {t.includes.includes(opt) ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="chip-row" style={{ marginBottom: 16 }}>
            <button
              className="chip"
              onClick={() =>
                setTiers((prev) => [...prev, { name: 'VIP', price: '79', quantity: '50', includes: ['Entry', 'Lounge access'] }])
              }
            >
              + Add tier
            </button>
            <button className={`chip ${earlyBird ? 'on' : ''}`} onClick={() => setEarlyBird((v) => !v)}>
              {earlyBird ? '✓ early-bird window' : '+ early-bird window'}
            </button>
            <label className="chip static">
              guest-list limit per booking:&nbsp;
              <input
                value={guestCap}
                onChange={(e) => setGuestCap(e.target.value)}
                style={{ width: 44, padding: '2px 6px', fontSize: 12 }}
                inputMode="numeric"
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              ← Back
            </button>
            <button className="btn btn-pri" disabled={!tiersValid} onClick={() => setStep(2)}>
              Next: Rules & line-up →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="field">
            <span>Event conditions (one per line — shown as bullets)</span>
            <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} />
          </div>
          <h3 style={{ margin: '6px 0 10px' }}>Party rules (accordions on event page)</h3>
          <div className="field">
            <span>Dress code</span>
            <input value={dressCode} onChange={(e) => setDressCode(e.target.value)} />
          </div>
          <div className="field">
            <span>Food & drinks</span>
            <input value={foodRule} onChange={(e) => setFoodRule(e.target.value)} />
          </div>
          <div className="field">
            <span>Prohibited items</span>
            <input value={prohibited} onChange={(e) => setProhibited(e.target.value)} />
          </div>
          <div className="field">
            <span>Line-up & partners — “Name (Role)”, comma-separated</span>
            <input value={lineup} onChange={(e) => setLineup(e.target.value)} placeholder="DJ Nova (Opening DJ), FizzCo (Sponsor)" />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button className="btn btn-pri" onClick={() => setStep(3)}>
              Next: SEO & publish →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>SEO options</h3>
          <div className="field">
            <span>SEO title</span>
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={`${title || 'Event'} | ${venue.city} tickets`}
            />
          </div>
          <div className="field">
            <span>Meta description (160 chars)</span>
            <input value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} maxLength={160} />
          </div>
          <div className="field">
            <span>URL slug</span>
            <input value={seoSlug} onChange={(e) => setSeoSlug(e.target.value)} placeholder={slug} />
          </div>
          <div className="field">
            <span>Keywords (comma-separated)</span>
            <input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} placeholder="indie concert, austin, live music" />
          </div>

          <div className="card" style={{ background: 'var(--surface-2)', padding: 16, marginBottom: 16 }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>
              Search preview:
            </div>
            <div style={{ color: '#8ab4f8', fontSize: 16, fontWeight: 600 }}>
              {seoTitle || `${title || 'Your event'} | ${venue.city} tickets`}
            </div>
            <div style={{ color: '#4fd394', fontSize: 12 }}>prebooze.com/events/{slug || 'your-event'}</div>
            <div className="muted small">{seoDesc || description.slice(0, 140) || 'Meta description preview…'}</div>
          </div>

          <Accordion title="What happens after submit?">
            Your event goes to admin review (status: Pending). Once approved it's live and bookable.
            Rejections come back with a reason so you can fix & resubmit.
          </Accordion>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button className="btn btn-pri" disabled={!step1Valid || !tiersValid} onClick={() => setPreview(true)}>
              Preview event →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
