import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { CATEGORY_TREE, fmtDate, fmtTime, subsFor } from '../../data/mock';
import type { Event, LineupProfile, PromoterProfile, Venue } from '../../types';
import Poster, { categoryEmoji } from '../../components/Poster';
import Accordion from '../../components/Accordion';
import WysiwygEditor from '../../components/WysiwygEditor';
import { organizer, catalog } from '../../api';
import { ApiError } from '../../api/client';

const STEPS = ['1 Basics', '2 Tickets', '3 Rules & line-up', '4 Promoters', '5 SEO & publish'];
const INCLUDE_OPTIONS = ['Entry', 'Welcome drink', 'Food coupon', 'Standing zone', 'Lounge access', '2 drinks', 'Meet & greet'];

interface TierDraft {
  id?: string;
  name: string;
  price: string;
  quantity: string;
  includes: string[];
  description: string;
}

const DEFAULT_TIERS: TierDraft[] = [{ name: 'General', price: '29', quantity: '500', includes: ['Entry', 'Welcome drink'], description: '' }];

/** Real event create/edit wizard — POST /organizer/events (upsert semantics,
 * see OrganizerService.saveEvent). Two things the old mock let an organizer
 * do that have no real backend today, dropped rather than faked:
 *  - Event banner / gallery / social-post images: the real Event.galleryUrls
 *    etc. are only ever written by admin (adminSetPoster's own comment says
 *    "NOT full admin event CRUD" — there's no organizer-facing upload route
 *    at all yet). An organizer can still fully create/submit an event; art
 *    gets added by the team after approval.
 *  - Ad-hoc "+ add new venue" / "+ create new line-up" from inside the
 *    wizard: venues and line-ups are their own onboarding + KYC flows, not
 *    something an organizer can spin up inline. Pick from the real roster. */
export default function CreateEvent() {
  const { user } = useApp();
  const { id: editId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [venues, setVenues] = useState<Venue[]>([]);
  const [lineups, setLineups] = useState<LineupProfile[]>([]);
  const [promoters, setPromoters] = useState<PromoterProfile[]>([]);
  const [editing, setEditing] = useState<Event | undefined>(undefined);

  // Step 1 — basics
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Concerts');
  const [subCategory, setSubCategory] = useState(subsFor('Concerts')[0] ?? '');
  const [ageLimit, setAgeLimit] = useState('18+');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [duration, setDuration] = useState('3');
  const [venueId, setVenueId] = useState('');
  const [venueSearch, setVenueSearch] = useState('');

  // Step 2 — tickets
  const [tiers, setTiers] = useState<TierDraft[]>(DEFAULT_TIERS);

  // Step 3 — rules & lineup
  const [conditions, setConditions] = useState('Photo ID required\nNo re-entry');
  const [dressCode, setDressCode] = useState('Smart casual — no flip-flops or sleeveless shirts.');
  const [foodRule, setFoodRule] = useState('Full bar inside. Outside food & drinks not permitted.');
  const [prohibited, setProhibited] = useState('No weapons, illegal substances or professional cameras.');
  const [lineupSel, setLineupSel] = useState<{ name: string; role: string }[]>([]);

  // Step 4 — promoters
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoCap, setPromoCap] = useState('200');
  const [promoCutoff, setPromoCutoff] = useState('01:00');
  const [allowedPromoters, setAllowedPromoters] = useState<string[]>([]);
  const [perHead, setPerHead] = useState(false);
  const [perHeadAmt, setPerHeadAmt] = useState('100');
  const [allowTeams, setAllowTeams] = useState(false);
  const togglePromoter = (slug: string) =>
    setAllowedPromoters((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));

  // Step 5 — SEO
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [seoSlug, setSeoSlug] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');

  useEffect(() => {
    Promise.all([
      catalog.venues(),
      catalog.lineups(),
      catalog.promoters(),
      editId ? organizer.events().then((evs) => evs.find((e) => e.id === editId)) : Promise.resolve(undefined),
    ])
      .then(([vs, ls, ps, ev]) => {
        setVenues(vs);
        setLineups(ls);
        setPromoters(ps);
        if (ev) {
          setEditing(ev);
          setTitle(ev.title);
          setDescription(ev.description);
          setCategory(ev.category);
          setSubCategory(ev.subCategory ?? subsFor(ev.category)[0] ?? '');
          setAgeLimit(ev.ageLimit);
          setDate(ev.date.slice(0, 10));
          const d = new Date(ev.date);
          setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
          setDuration(String(ev.durationHrs));
          setVenueId(ev.venueId);
          setTiers(ev.tiers.map((t) => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity), includes: t.includes, description: t.description ?? '' })));
          setConditions(ev.conditions.join('\n'));
          setDressCode(ev.rules.find((r) => r.title === 'Dress code')?.body ?? '');
          setFoodRule(ev.rules.find((r) => r.title === 'Food & drinks')?.body ?? '');
          setProhibited(ev.rules.find((r) => r.title === 'Prohibited items')?.body ?? '');
          setLineupSel(ev.lineup);
          const pc = ev.promoterConfig;
          if (pc) {
            setPromoEnabled(pc.enabled);
            setPromoCap(String(pc.cap));
            setPromoCutoff(pc.cutoff);
            setAllowedPromoters(pc.allowedPromoters);
            setPerHead(pc.perHeadPayout);
            setPerHeadAmt(String(pc.perHeadAmount));
            setAllowTeams(pc.allowTeams);
          }
          setSeoTitle(ev.seo?.title ?? '');
          setSeoDesc(ev.seo?.description ?? '');
          setSeoSlug(ev.seo?.slug ?? '');
          setSeoKeywords(ev.seo?.keywords.join(', ') ?? '');
        } else if (vs.length) {
          setVenueId(vs[0].id);
        }
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const toggleLineup = (l: { name: string; role: string }) =>
    setLineupSel((prev) =>
      prev.some((x) => x.name === l.name) ? prev.filter((x) => x.name !== l.name) : [...prev, l]
    );
  const venueMatches = venues.filter((v) =>
    (v.name + ' ' + v.locality + ' ' + v.city).toLowerCase().includes(venueSearch.toLowerCase())
  );

  const slug = useMemo(
    () =>
      (seoSlug || title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    [seoSlug, title]
  );

  const step1Valid = title.trim() && date && venueId;
  const tiersValid = tiers.length > 0 && tiers.every((t) => t.name.trim() && +t.price >= 0 && +t.quantity > 0);

  const buildPayload = (status: 'draft' | 'pending') => ({
    id: editing?.id,
    title: title.trim() || 'Untitled event',
    description: description.trim(),
    category,
    subCategory,
    ageLimit,
    tags: [category === 'Concerts' ? 'Concert' : category, ageLimit],
    date: new Date(`${date}T${time}`).toISOString(),
    durationHrs: +duration,
    venueId,
    status,
    conditions: conditions.split('\n').filter(Boolean),
    rules: [
      { title: 'Dress code', body: dressCode },
      { title: 'Food & drinks', body: foodRule },
      { title: 'Prohibited items', body: prohibited },
    ],
    lineup: lineupSel,
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      price: +t.price,
      quantity: +t.quantity,
      includes: t.includes,
      description: t.description.trim() || undefined,
    })),
    seo: {
      title: seoTitle || `${title} | tickets`,
      description: seoDesc || description.slice(0, 160),
      slug,
      keywords: seoKeywords.split(',').map((s) => s.trim()).filter(Boolean),
    },
    promoterConfig: {
      enabled: promoEnabled,
      cap: +promoCap || 0,
      cutoff: promoCutoff,
      allowedPromoters,
      perHeadPayout: perHead,
      perHeadAmount: +perHeadAmt || 0,
      allowTeams,
    },
  });

  const save = async (status: 'draft' | 'pending') => {
    setErr('');
    setSaving(true);
    try {
      await organizer.upsertEvent(buildPayload(status));
      navigate('/organizer/events');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save event');
      setSaving(false);
    }
  };

  const venue = venues.find((v) => v.id === venueId);
  const setTier = (i: number, patch: Partial<TierDraft>) =>
    setTiers((prev) => prev.map((t, x) => (x === i ? { ...t, ...patch } : t)));

  if (!ready) return <div className="muted">Loading…</div>;

  if (preview) {
    const ev = buildPayload('pending');
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20 }}>👁 Preview — guest view</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setPreview(false)}>
              ✎ Keep editing
            </button>
            <button className="btn btn-pri" disabled={saving} onClick={() => save('pending')}>
              {saving ? 'Submitting…' : 'Submit for approval →'}
            </button>
          </div>
        </div>
        {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

        <div className="card">
          <div className="detail-head">
            <Poster hue={(title.length * 47) % 360} emoji={categoryEmoji(ev.category)} label="portrait banner 3:4" />
            <div className="detail-title">
              <h1 style={{ fontSize: 24 }}>{ev.title}</h1>
              <div className="detail-meta">
                <span>📅 {fmtDate(ev.date)}, {fmtTime(ev.date)}</span>
                <span>📍 {venue?.name}, {venue?.city}</span>
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
          {editing ? `Edit event — ${editing.title}` : 'Create event'}
        </h1>
        {editing && <span className="badge badge-pending">edits resubmit for admin approval</span>}
      </div>
      {err && <div className="danger-text small" style={{ margin: '10px 0' }}>✕ {err}</div>}

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
          <div className="tiny muted" style={{ marginBottom: 16 }}>
            📷 Banner, gallery and social-share images are added by our team once your event is approved.
          </div>
          <div className="field">
            <span>Event title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>
          <div className="field">
            <span>Description</span>
            <WysiwygEditor value={description} onChange={setDescription} minHeight={100} />
          </div>
          <div className="form-row">
            <div className="field">
              <span>Category</span>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(subsFor(e.target.value)[0] ?? ''); }}>
                {CATEGORY_TREE.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <span>Sub-category</span>
              <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                {subsFor(category).map((s) => (
                  <option key={s}>{s}</option>
                ))}
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
              <span>Total duration (hours)</span>
              <input
                value={duration}
                inputMode="decimal"
                onChange={(e) => setDuration(e.target.value.replace(/[^0-9.]/g, '').slice(0, 4))}
                placeholder="e.g. 5 or 6.5"
              />
            </div>
          </div>
          <div className="field">
            <span>Venue</span>
            <input
              value={venueSearch}
              onChange={(e) => setVenueSearch(e.target.value)}
              placeholder="🔍 type to search venues…"
              style={{ marginBottom: 8 }}
            />
            <div className="chip-row">
              {venueMatches.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`chip ${venueId === v.id ? 'on' : ''}`}
                  onClick={() => setVenueId(v.id)}
                >
                  {v.name} · {v.locality || v.city}
                </button>
              ))}
              {venueMatches.length === 0 && <span className="muted small">no venues match "{venueSearch}"</span>}
            </div>
            <div className="tiny muted-2" style={{ marginTop: 6 }}>
              Venue not listed? They need to register as a Prebooze venue partner first.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" disabled={saving} onClick={() => save('draft')}>
              {saving ? 'Saving…' : 'Save draft'}
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
              <div className="field" style={{ marginTop: 10, marginBottom: 6 }}>
                <span>Ticket description — shown under this tier on the event page</span>
                <input
                  value={t.description}
                  onChange={(e) => setTier(i, { description: e.target.value })}
                  placeholder="e.g. Best value — entry, welcome drink and access to both stages"
                />
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
                setTiers((prev) => [...prev, { name: 'VIP', price: '79', quantity: '50', includes: ['Entry', 'Lounge access'], description: '' }])
              }
            >
              + Add tier
            </button>
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
            <span>Line-up & partners — pick from the real roster</span>
            <div className="chip-row" style={{ marginBottom: 8 }}>
              {lineups.map((l) => {
                const role = l.category === 'DJ' ? 'Opening DJ' : l.category === 'Sponsor' ? 'Sponsor' : l.category === 'Promoter' ? 'Promoter' : 'Headline artist';
                const on = lineupSel.some((x) => x.name === l.name);
                return (
                  <button key={l.id} type="button" className={`chip ${on ? 'on' : ''}`} onClick={() => toggleLineup({ name: l.name, role })}>
                    {l.name}
                    {on ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
            <div className="tiny muted-2" style={{ marginBottom: 8 }}>
              Artist not listed? They need to register as a Prebooze line-up first.
            </div>
            {lineupSel.length > 0 && (
              <div className="tiny muted-2">
                on the bill: {lineupSel.map((l) => `${l.name} (${l.role})`).join(' · ')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button className="btn btn-pri" onClick={() => setStep(3)}>
              Next: Promoters →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Promoter guest lists</h3>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Let approved promoters bring free-entry guests to this event, up to a cap and before a cutoff time.
            You choose exactly who's allowed.
          </p>

          <label
            className="checkbox-row"
            style={{ marginBottom: promoEnabled ? 16 : 0, padding: '12px 14px', border: '1.5px solid var(--border-3)', borderRadius: 10 }}
          >
            <input type="checkbox" checked={promoEnabled} onChange={(e) => setPromoEnabled(e.target.checked)} />
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>Enable promoter guest lists for this event</span>
          </label>

          {promoEnabled && (
            <>
              <div className="form-row" style={{ marginTop: 6 }}>
                <div className="field">
                  <span>Free-entry cap (total passes)</span>
                  <input value={promoCap} onChange={(e) => setPromoCap(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
                </div>
                <div className="field">
                  <span>Free entry valid before</span>
                  <input type="time" value={promoCutoff} onChange={(e) => setPromoCutoff(e.target.value)} />
                </div>
              </div>

              <div className="field">
                <span>Allowed promoters — only these can promote your event</span>
                <div className="chip-row">
                  {promoters.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      className={`chip ${allowedPromoters.includes(p.slug) ? 'on' : ''}`}
                      onClick={() => togglePromoter(p.slug)}
                    >
                      {p.name} {p.verified ? '✓' : ''}
                      {allowedPromoters.includes(p.slug) ? ' ·✓' : ''}
                    </button>
                  ))}
                </div>
                {allowedPromoters.length === 0 && (
                  <div className="tiny danger-text" style={{ marginTop: 6 }}>
                    Pick at least one promoter, or nobody can bring guests.
                  </div>
                )}
              </div>

              <div className="hr" />

              <label className="checkbox-row" style={{ marginBottom: 8 }}>
                <input type="checkbox" checked={perHead} onChange={(e) => setPerHead(e.target.checked)} />
                <span>Pay promoters per verified arrival</span>
              </label>
              {perHead && (
                <div className="field" style={{ maxWidth: 220, marginLeft: 26 }}>
                  <span>₹ per confirmed check-in</span>
                  <input value={perHeadAmt} onChange={(e) => setPerHeadAmt(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
                </div>
              )}

              <label className="checkbox-row">
                <input type="checkbox" checked={allowTeams} onChange={(e) => setAllowTeams(e.target.checked)} />
                <span>Allow promoter teams / sub-promoters</span>
              </label>

              <div className="tiny muted-2" style={{ marginTop: 12 }}>
                Guests on promoter lists get a time-based QR that's only valid before your cutoff. Everything rolls
                up to your gate scanner, tagged with which promoter brought them.
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button className="btn btn-pri" onClick={() => setStep(4)}>
              Next: SEO & publish →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>SEO options</h3>
          <div className="field">
            <span>SEO title</span>
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={`${title || 'Event'} | ${venue?.city ?? ''} tickets`}
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
              {seoTitle || `${title || 'Your event'} | ${venue?.city ?? ''} tickets`}
            </div>
            <div style={{ color: '#4fd394', fontSize: 12 }}>prebooze.com/events/{slug || 'your-event'}</div>
            <div className="muted small">{seoDesc || description.slice(0, 140) || 'Meta description preview…'}</div>
          </div>

          <Accordion title="What happens after submit?">
            Your event goes to admin review (status: Pending). Once approved it's live and bookable.
            Rejections come back with a reason so you can fix & resubmit.
          </Accordion>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setStep(3)}>
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
