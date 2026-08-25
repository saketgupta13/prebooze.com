import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { fmtDate, fmtTime } from '../../data/mock';
import type { Event, LineupProfile, PromoterProfile, Venue } from '../../types';
import Poster, { categoryEmoji } from '../../components/Poster';
import Loader from '../../components/Loader';
import Accordion from '../../components/Accordion';
import WysiwygEditor from '../../components/WysiwygEditor';
import SearchableSelect from '../../components/SearchableSelect';
import { RealUploadBox, RealGalleryUploadBox, RealVideoUploadBox } from '../../components/RealUploadBox';
import { organizer, catalog } from '../../api';
import { ApiError } from '../../api/client';
import { stripHtml } from '../../lib/richtext';

const STEPS = ['1 Basics', '2 Media', '3 Tickets', '4 Rules & line-up', '5 Promoters', '6 SEO & publish'];
const INCLUDE_OPTIONS = ['Entry', 'Welcome drink', 'Food coupon', 'Standing zone', 'Lounge access', '2 drinks', 'Meet & greet'];

interface TierDraft {
  id?: string;
  name: string;
  price: string;
  quantity: string;
  includes: string[];
  description: string;
  coverCharge: string;
  coverChargeNote: string;
  // Time-limited free entry — only meaningful when price is '0'. See
  // prebooze-web/src/lib/ticketTierPricing.ts for the effective-price
  // calculation guests see; empty strings = an ordinary tier, unaffected.
  freeCutoff: string;
  lateFeePrice: string;
}

const DEFAULT_TIERS: TierDraft[] = [{ name: 'General', price: '29', quantity: '500', includes: ['Entry', 'Welcome drink'], description: '', coverCharge: '', coverChargeNote: '', freeCutoff: '', lateFeePrice: '' }];

interface RuleDraft { title: string; body: string }
const DEFAULT_RULES: RuleDraft[] = [
  { title: 'Dress code', body: 'Smart casual — no flip-flops or sleeveless shirts.' },
  { title: 'Food & drinks', body: 'Full bar inside. Outside food & drinks not permitted.' },
  { title: 'Prohibited items', body: 'No weapons, illegal substances or professional cameras.' },
];

/** Real event create/edit wizard — POST /organizer/events (upsert semantics,
 * see OrganizerService.saveEvent). Poster/gallery/teaser/social images upload
 * for real via POST /organizer/upload, same StorageService as admin/venue.
 * Ad-hoc "+ add new venue" / "+ create new line-up" from inside the wizard
 * is still out of scope — venues and line-ups are their own onboarding + KYC
 * flows, not something an organizer can spin up inline. Pick from the real
 * roster. */
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
  const [subCategory, setSubCategory] = useState('');
  const [categories, setCategories] = useState<{ name: string; icon: string; subs: string[] }[]>([]);
  const subsFor = (cat: string) => categories.find((c) => c.name === cat)?.subs ?? [];
  const [ageLimit, setAgeLimit] = useState('18+');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [duration, setDuration] = useState('3');
  const [venueId, setVenueId] = useState('');
  // Private-address mode — no registered Venue at all, just a city (from the
  // same real GET /cities list guests filter by) + free-text locality.
  // Guests only ever see "{locality}, {city}"; the organizer is responsible
  // for telling booked guests the real address themselves.
  const [privateAddress, setPrivateAddress] = useState(false);
  const [liveCities, setLiveCities] = useState<string[]>([]);
  const [privateCity, setPrivateCity] = useState('');
  const [privateLocality, setPrivateLocality] = useState('');

  // Step 0 — media (real uploads, POST /organizer/upload)
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [teaserVideoUrl, setTeaserVideoUrl] = useState<string | null>(null);
  const [socialPostUrl, setSocialPostUrl] = useState('');
  const [socialStoryUrl, setSocialStoryUrl] = useState('');

  // Step 2 — tickets
  const [tiers, setTiers] = useState<TierDraft[]>(DEFAULT_TIERS);
  const [customIncludeInputs, setCustomIncludeInputs] = useState<Record<number, string>>({});

  // Step 3 — rules & lineup
  const [conditions, setConditions] = useState('Photo ID required\nNo re-entry');
  const [rules, setRules] = useState<RuleDraft[]>(DEFAULT_RULES);
  const [lineupSel, setLineupSel] = useState<{ name: string; role: string }[]>([]);

  // Step 4 — promoters
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoCap, setPromoCap] = useState('200');
  const [promoCutoff, setPromoCutoff] = useState('01:00');
  const [allowedPromoters, setAllowedPromoters] = useState<string[]>([]);
  // Two independent modes, picked per promoter (not one setting for the
  // whole event): Guest list (free entry, no ticket sold, optionally paid
  // per arrival via perHead/perHeadAmt below) and Paid commission (revenue
  // share % on ticket sales through their link). A promoter can have
  // either, both, or (rare) neither once added.
  const [guestListPromoters, setGuestListPromoters] = useState<string[]>([]);
  const [commissionPromoters, setCommissionPromoters] = useState<string[]>([]);
  const [perHead, setPerHead] = useState(false);
  const [perHeadAmt, setPerHeadAmt] = useState('100');
  const [allowTeams, setAllowTeams] = useState(false);
  // Negotiated individually per promoter, not one rate for the whole event
  // — slug -> % (0-100) of the base ticket price, added on top as a
  // guest-funded markup (see BookingsService.priceHold). Only applies for
  // promoters with the Paid commission checkbox on (commissionPromoters).
  const [revenueShare, setRevenueShare] = useState<Record<string, string>>({});
  const togglePromoter = (slug: string) => {
    setAllowedPromoters((prev) => {
      if (prev.includes(slug)) {
        setGuestListPromoters((g) => g.filter((x) => x !== slug));
        setCommissionPromoters((c) => c.filter((x) => x !== slug));
        return prev.filter((x) => x !== slug);
      }
      // newly added — default to Guest list mode on, matching the
      // long-standing behavior before Paid commission existed as a choice
      setGuestListPromoters((g) => (g.includes(slug) ? g : [...g, slug]));
      return [...prev, slug];
    });
  };
  const toggleGuestList = (slug: string) =>
    setGuestListPromoters((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));
  const toggleCommission = (slug: string) =>
    setCommissionPromoters((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));

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
      catalog.categories(),
      catalog.cities(),
      editId ? organizer.events().then((evs) => evs.find((e) => e.id === editId)) : Promise.resolve(undefined),
    ])
      .then(([vs, ls, ps, cats, cities, ev]) => {
        setVenues(vs);
        setLineups(ls);
        setPromoters(ps);
        setCategories(cats);
        setLiveCities(cities.map((c) => c.name).sort());
        const subsForCat = (cat: string) => cats.find((c) => c.name === cat)?.subs ?? [];
        if (!ev) setSubCategory(subsForCat(category)[0] ?? '');
        if (ev) {
          setEditing(ev);
          setTitle(ev.title);
          setDescription(ev.description);
          setCategory(ev.category);
          setSubCategory(ev.subCategory ?? subsForCat(ev.category)[0] ?? '');
          setAgeLimit(ev.ageLimit);
          // ev.date is a UTC ISO string — derive both fields from local Date
          // getters (not a raw slice of the UTC string), so an event near
          // midnight IST doesn't show the wrong calendar day, and the time
          // field always matches what was actually entered.
          const d = new Date(ev.date);
          setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
          setDuration(String(ev.durationHrs));
          if (ev.venueId) {
            setVenueId(ev.venueId);
          } else {
            setPrivateAddress(true);
            setPrivateCity(ev.privateCity ?? '');
            setPrivateLocality(ev.privateLocality ?? '');
          }
          setPosterUrl(ev.posterUrl ?? null);
          setGalleryUrls(ev.galleryUrls ?? []);
          setTeaserVideoUrl(ev.teaserVideoUrl ?? null);
          setSocialPostUrl(ev.socialBanners?.postUrl ?? '');
          setSocialStoryUrl(ev.socialBanners?.storyUrl ?? '');
          setTiers(ev.tiers.map((t) => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity), includes: t.includes, description: t.description ?? '', coverCharge: t.coverCharge ? String(t.coverCharge) : '', coverChargeNote: t.coverChargeNote ?? '', freeCutoff: t.freeCutoff ?? '', lateFeePrice: t.lateFeePrice != null ? String(t.lateFeePrice) : '' })));
          setConditions(ev.conditions.join('\n'));
          setRules(ev.rules.length ? ev.rules.map((r) => ({ title: r.title, body: r.body })) : DEFAULT_RULES);
          setLineupSel(ev.lineup);
          const pc = ev.promoterConfig;
          if (pc) {
            setPromoEnabled(pc.enabled);
            setPromoCap(String(pc.cap));
            setPromoCutoff(pc.cutoff);
            setAllowedPromoters(pc.allowedPromoters);
            // missing guestListPromoters (events saved before this field
            // existed) defaults to every allowed promoter — preserves what
            // was actually live before, rather than silently un-checking
            // promoters who are still earning per-head payouts today
            setGuestListPromoters(pc.guestListPromoters ?? pc.allowedPromoters);
            setPerHead(pc.perHeadPayout);
            setPerHeadAmt(String(pc.perHeadAmount));
            setAllowTeams(pc.allowTeams);
            setRevenueShare(Object.fromEntries(Object.entries(pc.revenueShare ?? {}).map(([slug, pct]) => [slug, String(pct)])));
            setCommissionPromoters(Object.entries(pc.revenueShare ?? {}).filter(([, pct]) => pct > 0).map(([slug]) => slug));
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
  const venueLabel = (v: Venue) => `${v.name} · ${v.locality || v.city}`;
  const setRule = (i: number, patch: Partial<RuleDraft>) => setRules((prev) => prev.map((r, x) => (x === i ? { ...r, ...patch } : r)));

  const slug = useMemo(
    () =>
      (seoSlug || title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    [seoSlug, title]
  );

  const step1Valid = title.trim() && date && (privateAddress ? privateCity.trim() && privateLocality.trim() : venueId);
  const tiersValid = tiers.length > 0 && tiers.every((t) => t.name.trim() && +t.price >= 0 && +t.quantity > 0 && (!t.freeCutoff || (+t.lateFeePrice > 0)));

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
    ...(privateAddress
      ? { privateCity: privateCity.trim(), privateLocality: privateLocality.trim() }
      : { venueId }),
    status,
    conditions: conditions.split('\n').filter(Boolean),
    rules: rules.filter((r) => r.title.trim() || r.body.trim()),
    lineup: lineupSel,
    posterUrl,
    galleryUrls,
    teaserVideoUrl,
    socialBanners: { postUrl: socialPostUrl || undefined, storyUrl: socialStoryUrl || undefined },
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      price: +t.price,
      quantity: +t.quantity,
      includes: t.includes,
      description: t.description.trim() || undefined,
      coverCharge: t.coverCharge.trim() ? +t.coverCharge : undefined,
      coverChargeNote: t.coverChargeNote.trim() || undefined,
      // Only meaningful (and only ever persisted) for a ₹0 tier — clears
      // automatically if the tier's price is later changed off 0, so a
      // stale cutoff/late-price can't linger on a now-paid tier.
      freeCutoff: +t.price === 0 && t.freeCutoff.trim() ? t.freeCutoff.trim() : undefined,
      lateFeePrice: +t.price === 0 && t.freeCutoff.trim() && t.lateFeePrice.trim() ? +t.lateFeePrice : undefined,
    })),
    seo: {
      title: seoTitle || `${title} | tickets`,
      description: seoDesc || stripHtml(description).slice(0, 160),
      slug,
      keywords: seoKeywords.split(',').map((s) => s.trim()).filter(Boolean),
    },
    promoterConfig: {
      enabled: promoEnabled,
      cap: +promoCap || 0,
      cutoff: promoCutoff,
      allowedPromoters,
      guestListPromoters,
      perHeadPayout: perHead,
      perHeadAmount: +perHeadAmt || 0,
      allowTeams,
      revenueShare: Object.fromEntries(
        allowedPromoters
          .filter((slug) => commissionPromoters.includes(slug))
          .map((slug) => [slug, +revenueShare[slug] || 0] as const)
          .filter(([, pct]) => pct > 0)
      ),
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
  const cityForSeo = venue?.city ?? (privateAddress ? privateCity : '');
  const venuePhotosToAdd = (venue?.galleryUrls ?? []).filter((u) => !galleryUrls.includes(u));
  const setTier = (i: number, patch: Partial<TierDraft>) =>
    setTiers((prev) => prev.map((t, x) => (x === i ? { ...t, ...patch } : t)));

  const addCustomInclude = (i: number) => {
    const val = (customIncludeInputs[i] ?? '').trim();
    if (!val) return;
    const t = tiers[i];
    if (!t.includes.includes(val)) setTier(i, { includes: [...t.includes, val] });
    setCustomIncludeInputs((prev) => ({ ...prev, [i]: '' }));
  };

  if (!ready) return <Loader />;

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
            <Poster hue={(title.length * 47) % 360} emoji={categoryEmoji(ev.category)} label="portrait banner 3:4" imageUrl={ev.posterUrl} alt={ev.title} />
            <div className="detail-title">
              <h1 style={{ fontSize: 24 }}>{ev.title}</h1>
              <div className="detail-meta">
                <span>📅 {fmtDate(ev.date)}, {fmtTime(ev.date)}</span>
                <span>📍 {venue ? `${venue.name}, ${venue.city}` : privateAddress ? `${privateLocality}, ${privateCity}` : ''}</span>
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
          {ev.description ? (
            <div className="muted small rich-text" dangerouslySetInnerHTML={{ __html: ev.description }} />
          ) : (
            <p className="muted small">No description yet.</p>
          )}
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
                {categories.map((c) => (
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
              <input type="checkbox" checked={privateAddress} onChange={(e) => setPrivateAddress(e.target.checked)} />
              Keep exact address private — I'll share it with guests myself
            </label>
          </div>
          {privateAddress ? (
            <div className="field">
              <span>City & locality</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <SearchableSelect
                  value={privateCity}
                  onChange={setPrivateCity}
                  options={liveCities}
                  placeholder="🔍 search cities…"
                />
                <input
                  value={privateLocality}
                  onChange={(e) => setPrivateLocality(e.target.value)}
                  placeholder="Locality, e.g. Banjara Hills"
                  style={{ flex: 1 }}
                />
              </div>
              <div className="tiny muted-2" style={{ marginTop: 6 }}>
                Guests will only ever see "{privateLocality || 'locality'}, {privateCity || 'city'}" — no venue name, no address, no map. You're
                responsible for sending the real address to everyone who books (export the attendee list from Attendees once tickets sell).
              </div>
            </div>
          ) : (
            <div className="field">
              <span>Venue</span>
              <SearchableSelect
                value={venue ? venueLabel(venue) : ''}
                onChange={(label) => {
                  const v = venues.find((vv) => venueLabel(vv) === label);
                  if (v) setVenueId(v.id);
                }}
                options={venues.map(venueLabel)}
                placeholder="🔍 search venues…"
              />
              <div className="tiny muted-2" style={{ marginTop: 6 }}>
                Venue not listed? They need to register as a Prebooze venue partner first.
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" disabled={saving} onClick={() => save('draft')}>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button className="btn btn-pri" disabled={!step1Valid} onClick={() => setStep(1)}>
              Next: Media →
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Event media</h3>
          <p className="muted small" style={{ marginBottom: 16 }}>All optional — a poster helps your event stand out, everything else is a nice-to-have.</p>
          <div className="field">
            <span>Poster (portrait 3:4) — shown on your event card & page</span>
            <RealUploadBox value={posterUrl} onChange={setPosterUrl} upload={organizer.upload} label="⬆ upload poster" style={{ height: 200, width: 160 }} />
          </div>
          <div className="field">
            <span>Gallery photos (optional, up to 6)</span>
            {!!venuePhotosToAdd.length && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start', marginBottom: 8 }}
                onClick={() => setGalleryUrls((prev) => [...prev, ...venuePhotosToAdd].slice(0, 6))}
              >
                + Use {venue!.name}'s photos ({venuePhotosToAdd.length})
              </button>
            )}
            <RealGalleryUploadBox value={galleryUrls} onChange={setGalleryUrls} upload={organizer.upload} />
          </div>
          <div className="field">
            <span>Teaser reel (optional)</span>
            <RealVideoUploadBox value={teaserVideoUrl} onChange={setTeaserVideoUrl} upload={organizer.upload} label="⬆ teaser video · 9:16" />
            <input
              className="input"
              placeholder="or paste a link — Instagram Reel, YouTube, or a direct video file"
              value={teaserVideoUrl ?? ''}
              onChange={(e) => setTeaserVideoUrl(e.target.value || null)}
              style={{ marginTop: 8 }}
            />
          </div>
          <div className="form-row">
            <div className="field">
              <span>Social post image (1:1, optional)</span>
              <RealUploadBox value={socialPostUrl || null} onChange={setSocialPostUrl} upload={organizer.upload} label="⬆ post 1:1" style={{ height: 110, width: 110 }} />
            </div>
            <div className="field">
              <span>Social story image (9:16, optional)</span>
              <RealUploadBox value={socialStoryUrl || null} onChange={setSocialStoryUrl} upload={organizer.upload} label="⬆ story 9:16" style={{ height: 160, width: 90 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              ← Back
            </button>
            <button className="btn btn-pri" onClick={() => setStep(2)}>
              Next: Tickets →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
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
              <div className="form-row" style={{ marginBottom: 6 }}>
                <div className="field">
                  <span>Cover charge ₹ (optional)</span>
                  <input
                    value={t.coverCharge}
                    onChange={(e) => setTier(i, { coverCharge: e.target.value })}
                    inputMode="numeric"
                    placeholder="e.g. 1000"
                  />
                </div>
                <div className="field">
                  <span>Redeemable for (optional)</span>
                  <input
                    value={t.coverChargeNote}
                    onChange={(e) => setTier(i, { coverChargeNote: e.target.value })}
                    placeholder="e.g. food & drinks at the venue"
                  />
                </div>
              </div>
              {t.coverCharge.trim() && +t.coverCharge > (+t.price || 0) && (
                <div className="tiny danger-text" style={{ marginBottom: 6 }}>
                  Cover charge can't exceed the ticket price
                </div>
              )}
              {t.coverCharge.trim() && +t.coverCharge > 0 && !(+t.coverCharge > (+t.price || 0)) && (
                <div className="tiny muted" style={{ marginBottom: 6 }}>
                  Guests see this ticket includes ₹{t.coverCharge} redeemable at the venue{t.coverChargeNote.trim() ? ` (${t.coverChargeNote.trim()})` : ''}.
                </div>
              )}
              {+t.price === 0 && (
                <div className="form-row" style={{ marginBottom: 6 }}>
                  <div className="field">
                    <span>Free until (optional)</span>
                    <input
                      type="time"
                      value={t.freeCutoff}
                      onChange={(e) => setTier(i, { freeCutoff: e.target.value })}
                      // Safari can be inconsistent about firing onChange while
                      // a native time input is still being filled in segment
                      // by segment — re-sync on blur so the value isn't lost.
                      onBlur={(e) => setTier(i, { freeCutoff: e.target.value })}
                    />
                  </div>
                  {t.freeCutoff && (
                    <div className="field">
                      <span>Price after grace period ₹</span>
                      <input
                        value={t.lateFeePrice}
                        onChange={(e) => setTier(i, { lateFeePrice: e.target.value })}
                        inputMode="numeric"
                        placeholder="e.g. 200"
                      />
                    </div>
                  )}
                </div>
              )}
              {+t.price === 0 && t.freeCutoff && +t.lateFeePrice > 0 && (
                <div className="tiny muted" style={{ marginBottom: 6 }}>
                  Free until {t.freeCutoff}, then new bookings are ₹{t.lateFeePrice}. Guests who already booked free and run up to 15 min late — letting them in is your call at the door, Prebooze doesn't guarantee it.
                </div>
              )}
              {+t.price === 0 && t.freeCutoff && !(+t.lateFeePrice > 0) && (
                <div className="tiny danger-text" style={{ marginBottom: 6 }}>
                  Set a price after the grace period, or clear the cutoff time
                </div>
              )}
              <div className="chip-row">
                {Array.from(new Set([...INCLUDE_OPTIONS, ...t.includes])).map((opt) => (
                  <button
                    key={opt}
                    className={`chip chip-tap ${t.includes.includes(opt) ? 'on' : ''}`}
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
              <div className="chip-row" style={{ marginTop: 6 }}>
                <input
                  value={customIncludeInputs[i] ?? ''}
                  onChange={(e) => setCustomIncludeInputs((prev) => ({ ...prev, [i]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomInclude(i);
                    }
                  }}
                  placeholder="Add custom…"
                  style={{ fontSize: 12, padding: '4px 10px', flex: 1, minWidth: 100 }}
                />
                <button type="button" className="chip chip-tap" style={{ fontSize: 12, padding: '4px 11px' }} onClick={() => addCustomInclude(i)}>
                  + Add
                </button>
              </div>
            </div>
          ))}

          <div className="chip-row" style={{ marginBottom: 16 }}>
            <button
              className="chip"
              onClick={() =>
                setTiers((prev) => [...prev, { name: 'VIP', price: '79', quantity: '50', includes: ['Entry', 'Lounge access'], description: '', coverCharge: '', coverChargeNote: '', freeCutoff: '', lateFeePrice: '' }])
              }
            >
              + Add tier
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button className="btn btn-pri" disabled={!tiersValid} onClick={() => setStep(3)}>
              Next: Rules & line-up →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="field">
            <span>Event conditions (one per line — shown as bullets)</span>
            <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} />
          </div>
          <h3 style={{ margin: '6px 0 10px' }}>Event rules (accordions on event page)</h3>
          {rules.map((r, i) => (
            <div key={i} className="form-row" style={{ alignItems: 'center' }}>
              <div className="field" style={{ flex: '0 0 160px' }}>
                <span>Rule title</span>
                <input value={r.title} onChange={(e) => setRule(i, { title: e.target.value })} placeholder="e.g. Age policy" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <span>Details</span>
                <input value={r.body} onChange={(e) => setRule(i, { body: e.target.value })} />
              </div>
              <button
                className="icon-round"
                style={{ alignSelf: 'center', flex: '0 0 auto', background: 'none' }}
                onClick={() => setRules((prev) => prev.filter((_, x) => x !== i))}
                title="Remove rule"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="chip-row" style={{ marginBottom: 16 }}>
            <button type="button" className="chip" onClick={() => setRules((prev) => [...prev, { title: '', body: '' }])}>
              + Add rule
            </button>
          </div>
          <div className="field">
            <span>Line-up & partners — pick from the real roster</span>
            <SearchableSelect
              value=""
              onChange={(name) => {
                const l = lineups.find((x) => x.name === name);
                if (!l) return;
                const role = l.category === 'DJ' ? 'Opening DJ' : l.category === 'Sponsor' ? 'Sponsor' : l.category === 'Promoter' ? 'Promoter' : 'Headline artist';
                toggleLineup({ name: l.name, role });
              }}
              options={lineups.filter((l) => !lineupSel.some((x) => x.name === l.name)).map((l) => l.name)}
              placeholder="🔍 search line-up & partners to add…"
            />
            <div className="tiny muted-2" style={{ margin: '8px 0' }}>
              Artist not listed? They need to register as a Prebooze line-up first.
            </div>
            {lineupSel.length > 0 && (
              <div className="chip-row">
                {lineupSel.map((l) => (
                  <button key={l.name} type="button" className="chip on" onClick={() => toggleLineup(l)} title="Remove from bill">
                    {l.name} ({l.role}) ✕
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button className="btn btn-pri" onClick={() => setStep(4)}>
              Next: Promoters →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Promoters</h3>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Let approved promoters bring free-entry guests, earn a commission on ticket sales through their link,
            or both — you choose per promoter.
          </p>

          <label
            className="checkbox-row"
            style={{ marginBottom: promoEnabled ? 16 : 0, padding: '12px 14px', border: '1.5px solid var(--border-3)', borderRadius: 10 }}
          >
            <input type="checkbox" checked={promoEnabled} onChange={(e) => setPromoEnabled(e.target.checked)} />
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>Enable promoters for this event</span>
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
                <span>Allowed promoters — pick who, and how each one promotes your event</span>
                <div className="tiny muted-2" style={{ marginBottom: 8 }}>
                  🎟️ Guest list = free entry, no ticket sold. 💰 Paid commission = a % of the ticket price on any
                  sale through their link, added on top so it doesn't cut into your revenue (the guest pays the
                  extra, same as Prebooze's own commission on that sale). Pick either, both, or leave a promoter
                  unchecked on both to add them without activating anything yet.
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {promoters.map((p) => {
                    const isAllowed = allowedPromoters.includes(p.slug);
                    const hasGuestList = guestListPromoters.includes(p.slug);
                    const hasCommission = commissionPromoters.includes(p.slug);
                    return (
                      <div key={p.slug} style={{ border: '1.5px solid var(--border-3)', borderRadius: 10, padding: '10px 12px' }}>
                        <label className="checkbox-row">
                          <input type="checkbox" checked={isAllowed} onChange={() => togglePromoter(p.slug)} />
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{p.name} {p.verified ? '✓' : ''}</span>
                        </label>
                        {isAllowed && (
                          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, marginLeft: 26 }}>
                            <label className="checkbox-row" style={{ marginBottom: 0 }}>
                              <input type="checkbox" checked={hasGuestList} onChange={() => toggleGuestList(p.slug)} />
                              <span className="small">🎟️ Guest list</span>
                            </label>
                            <label className="checkbox-row" style={{ marginBottom: 0 }}>
                              <input type="checkbox" checked={hasCommission} onChange={() => toggleCommission(p.slug)} />
                              <span className="small">💰 Paid commission</span>
                            </label>
                            {hasCommission && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  className="input"
                                  style={{ width: 70 }}
                                  value={revenueShare[p.slug] ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                                    setRevenueShare((prev) => ({ ...prev, [p.slug]: v }));
                                  }}
                                  inputMode="numeric"
                                  placeholder="0"
                                />
                                <span className="small muted-2">%</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {allowedPromoters.length === 0 && (
                  <div className="tiny danger-text" style={{ marginTop: 6 }}>
                    Pick at least one promoter, or nobody can promote your event.
                  </div>
                )}
              </div>

              <div className="hr" />

              <label className="checkbox-row" style={{ marginBottom: 8 }}>
                <input type="checkbox" checked={perHead} onChange={(e) => setPerHead(e.target.checked)} />
                <span>Pay promoters per verified arrival <span className="muted-2">(applies to promoters with Guest list checked above)</span></span>
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
            <button className="btn btn-ghost" onClick={() => setStep(3)}>
              ← Back
            </button>
            <button className="btn btn-pri" onClick={() => setStep(5)}>
              Next: SEO & publish →
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>SEO options</h3>
          <div className="field">
            <span>SEO title</span>
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={`${title || 'Event'} | ${cityForSeo} tickets`}
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
              {seoTitle || `${title || 'Your event'} | ${cityForSeo} tickets`}
            </div>
            <div style={{ color: '#4fd394', fontSize: 12 }}>prebooze.com/events/{slug || 'your-event'}</div>
            <div className="muted small">{seoDesc || stripHtml(description).slice(0, 140) || 'Meta description preview…'}</div>
          </div>

          <Accordion title="What happens after submit?">
            Your event goes to admin review (status: Pending). Once approved it's live and bookable.
            Rejections come back with a reason so you can fix & resubmit.
          </Accordion>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setStep(4)}>
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
