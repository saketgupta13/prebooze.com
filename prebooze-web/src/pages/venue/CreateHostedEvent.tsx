import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Event, LineupProfile, PromoterProfile } from '../../types';
import Loader from '../../components/Loader';
import Accordion from '../../components/Accordion';
import WysiwygEditor from '../../components/WysiwygEditor';
import SearchableSelect from '../../components/SearchableSelect';
import { RealUploadBox, RealGalleryUploadBox, RealVideoUploadBox } from '../../components/RealUploadBox';
import { venuePartner, catalog, type VenueCollaboratorOption } from '../../api';
import { ApiError } from '../../api/client';
import { stripHtml } from '../../lib/richtext';
import { AlertCircle, X, Check, Ticket, Banknote } from 'lucide-react';

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
  freeCutoff: string;
  lateFeePrice: string;
}
const DEFAULT_TIERS: TierDraft[] = [{ name: 'General', price: '29', quantity: '500', includes: ['Entry', 'Welcome drink'], description: '', coverCharge: '', coverChargeNote: '', freeCutoff: '', lateFeePrice: '' }];

interface RuleDraft { title: string; body: string }
const DEFAULT_RULES: RuleDraft[] = [
  { title: 'Dress code', body: 'Smart casual — no flip-flops or sleeveless shirts.' },
  { title: 'Food & drinks', body: 'Full bar inside. Outside food & drinks not permitted.' },
];

/** Create/edit an event this venue hosts itself — POST /venue/hosting/events
 * (upsert, see VenueService.saveHostedEvent). Always hosted at this venue's
 * own address (no venue picker, unlike the organizer flow) with an optional
 * real, verified organizer as collaborator (no invite/consent needed — same
 * as an organizer already picking any venue). A deliberate, simpler single-
 * page form rather than organizer/CreateEvent.tsx's 6-step wizard, but with
 * the same real promoter-management block (backend already accepted
 * promoterConfig as a passthrough field from the start). */
export default function CreateHostedEvent() {
  const { id: editId } = useParams();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [lineups, setLineups] = useState<LineupProfile[]>([]);
  const [promoters, setPromoters] = useState<PromoterProfile[]>([]);
  const [collaborators, setCollaborators] = useState<VenueCollaboratorOption[]>([]);
  const [editing, setEditing] = useState<Event | undefined>(undefined);

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
  const [organizerId, setOrganizerId] = useState<string>('');

  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [teaserVideoUrl, setTeaserVideoUrl] = useState<string | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [teaserUploading, setTeaserUploading] = useState(false);
  const mediaUploading = posterUploading || galleryUploading || teaserUploading;
  // This event is always hosted at the venue's own address (see the
  // no-venue-picker note below), so "the venue" for gallery-reuse purposes
  // is just this venue's own listing — fetched once, not derived from a
  // selection like the organizer flow's venuePicker.
  const [ownVenueGallery, setOwnVenueGallery] = useState<string[]>([]);

  const [tiers, setTiers] = useState<TierDraft[]>(DEFAULT_TIERS);
  const [customIncludeInputs, setCustomIncludeInputs] = useState<Record<number, string>>({});

  const [conditions, setConditions] = useState('Photo ID required\nNo re-entry');
  const [rules, setRules] = useState<RuleDraft[]>(DEFAULT_RULES);
  const [lineupSel, setLineupSel] = useState<{ name: string; role: string }[]>([]);

  // Promoters — same two independent modes as organizer/CreateEvent.tsx:
  // guest list (free entry) and paid commission (revenue-share %), picked
  // per promoter, either/both/neither.
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoCap, setPromoCap] = useState('200');
  const [promoCutoff, setPromoCutoff] = useState('01:00');
  const [allowedPromoters, setAllowedPromoters] = useState<string[]>([]);
  const [guestListPromoters, setGuestListPromoters] = useState<string[]>([]);
  const [commissionPromoters, setCommissionPromoters] = useState<string[]>([]);
  const [perHead, setPerHead] = useState(false);
  const [perHeadAmt, setPerHeadAmt] = useState('100');
  const [allowTeams, setAllowTeams] = useState(false);
  const [revenueShare, setRevenueShare] = useState<Record<string, string>>({});
  const togglePromoter = (slug: string) => {
    setAllowedPromoters((prev) => {
      if (prev.includes(slug)) {
        setGuestListPromoters((g) => g.filter((x) => x !== slug));
        setCommissionPromoters((c) => c.filter((x) => x !== slug));
        return prev.filter((x) => x !== slug);
      }
      setGuestListPromoters((g) => (g.includes(slug) ? g : [...g, slug]));
      return [...prev, slug];
    });
  };
  const toggleGuestList = (slug: string) =>
    setGuestListPromoters((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));
  const toggleCommission = (slug: string) =>
    setCommissionPromoters((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));

  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [seoSlug, setSeoSlug] = useState('');

  useEffect(() => {
    Promise.all([
      catalog.lineups(),
      catalog.promoters(),
      venuePartner.collaboratorOptions(),
      catalog.categories(),
      editId ? venuePartner.hostedEvents().then((evs) => evs.find((e) => e.id === editId)) : Promise.resolve(undefined),
      venuePartner.myListing().catch(() => null),
    ])
      .then(([ls, ps, orgs, cats, ev, listing]) => {
        setLineups(ls);
        setPromoters(ps);
        setCollaborators(orgs);
        setCategories(cats);
        setOwnVenueGallery(listing?.galleryUrls ?? []);
        const subsForCat = (cat: string) => cats.find((c) => c.name === cat)?.subs ?? [];
        if (!ev) setSubCategory(subsForCat(category)[0] ?? '');
        if (ev) {
          setEditing(ev);
          setTitle(ev.title);
          setDescription(ev.description);
          setCategory(ev.category);
          setSubCategory(ev.subCategory ?? subsForCat(ev.category)[0] ?? '');
          setAgeLimit(ev.ageLimit);
          const d = new Date(ev.date);
          setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
          setDuration(String(ev.durationHrs));
          setOrganizerId(ev.organizerId ?? '');
          setPosterUrl(ev.posterUrl ?? null);
          setGalleryUrls(ev.galleryUrls ?? []);
          setTeaserVideoUrl(ev.teaserVideoUrl ?? null);
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
        }
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const toggleLineup = (l: { name: string; role: string }) =>
    setLineupSel((prev) => (prev.some((x) => x.name === l.name) ? prev.filter((x) => x.name !== l.name) : [...prev, l]));
  const setRule = (i: number, patch: Partial<RuleDraft>) => setRules((prev) => prev.map((r, x) => (x === i ? { ...r, ...patch } : r)));
  const setTier = (i: number, patch: Partial<TierDraft>) => setTiers((prev) => prev.map((t, x) => (x === i ? { ...t, ...patch } : t)));

  const addCustomInclude = (i: number) => {
    const val = (customIncludeInputs[i] ?? '').trim();
    if (!val) return;
    const t = tiers[i];
    if (!t.includes.includes(val)) setTier(i, { includes: [...t.includes, val] });
    setCustomIncludeInputs((prev) => ({ ...prev, [i]: '' }));
  };

  const slug = useMemo(
    () => (seoSlug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    [seoSlug, title]
  );

  const step1Valid = Boolean(title.trim() && date);
  const tiersValid = tiers.length > 0 && tiers.every((t) => t.name.trim() && +t.price >= 0 && +t.quantity > 0 && (!t.freeCutoff || (+t.lateFeePrice > 0)));
  const canSubmit = step1Valid && tiersValid;

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
    organizerId: organizerId || null,
    status,
    conditions: conditions.split('\n').filter(Boolean),
    rules: rules.filter((r) => r.title.trim() || r.body.trim()),
    lineup: lineupSel,
    posterUrl,
    galleryUrls,
    teaserVideoUrl,
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
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      price: +t.price,
      quantity: +t.quantity,
      includes: t.includes,
      description: t.description.trim() || undefined,
      coverCharge: t.coverCharge.trim() ? +t.coverCharge : undefined,
      coverChargeNote: t.coverChargeNote.trim() || undefined,
      freeCutoff: +t.price === 0 && t.freeCutoff.trim() ? t.freeCutoff.trim() : undefined,
      lateFeePrice: +t.price === 0 && t.freeCutoff.trim() && t.lateFeePrice.trim() ? +t.lateFeePrice : undefined,
    })),
    seo: {
      title: seoTitle || `${title} | tickets`,
      description: seoDesc || stripHtml(description).slice(0, 160),
      slug,
      keywords: [],
    },
  });

  const save = async (status: 'draft' | 'pending') => {
    setErr('');
    if (mediaUploading) { setErr('Media is still uploading — wait for it to finish before saving'); return; }
    setSaving(true);
    try {
      await venuePartner.upsertHostedEvent(buildPayload(status));
      navigate('/venue/hosting/events');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save event');
      setSaving(false);
    }
  };

  const venuePhotosToAdd = ownVenueGallery.filter((u) => !galleryUrls.includes(u));

  if (!ready) return <Loader />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>
          <Link to="/venue/hosting/events" className="muted">←</Link>{' '}
          {editing ? `Edit event — ${editing.title}` : 'Create event you host'}
        </h1>
        {editing && <span className="badge badge-pending">edits resubmit for admin approval</span>}
      </div>
      {err && <div className="danger-text small" style={{ margin: '10px 0', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={14} /> {err}</div>}

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
              {categories.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <span>Sub-category</span>
            <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
              {subsFor(category).map((s) => <option key={s}>{s}</option>)}
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
            <input value={duration} inputMode="decimal" onChange={(e) => setDuration(e.target.value.replace(/[^0-9.]/g, '').slice(0, 4))} placeholder="e.g. 5 or 6.5" />
          </div>
        </div>
        <div className="field">
          <span>Collaborating organizer (optional) — leave blank to host solo</span>
          <SearchableSelect
            value={collaborators.find((o) => o.id === organizerId)?.brandName ?? ''}
            onChange={(label) => {
              if (!label) { setOrganizerId(''); return; }
              const o = collaborators.find((oo) => oo.brandName === label);
              setOrganizerId(o?.id ?? '');
            }}
            options={collaborators.map((o) => o.brandName)}
            placeholder="Search verified organizers…"
          />
          <div className="tiny muted-2" style={{ marginTop: 6 }}>
            No invite needed — this event still belongs to your venue's own ledger and dashboard either way. Any
            revenue split with the organizer happens directly between you two.
          </div>
          {organizerId && (
            <button type="button" className="chip on" style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setOrganizerId('')}>
              {collaborators.find((o) => o.id === organizerId)?.brandName} <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 4 }}>Event media</h3>
        <p className="muted small" style={{ marginBottom: 16 }}>All optional — a poster helps your event stand out.</p>
        <div className="field">
          <span>Poster (portrait 3:4)</span>
          <RealUploadBox value={posterUrl} onChange={setPosterUrl} upload={venuePartner.upload} onBusyChange={setPosterUploading} label="⬆ upload poster" style={{ height: 200, width: 160 }} />
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
              + Use your venue's photos ({venuePhotosToAdd.length})
            </button>
          )}
          <RealGalleryUploadBox value={galleryUrls} onChange={setGalleryUrls} upload={venuePartner.upload} onBusyChange={setGalleryUploading} />
        </div>
        <div className="field">
          <span>Teaser reel (optional)</span>
          <RealVideoUploadBox value={teaserVideoUrl} onChange={setTeaserVideoUrl} upload={venuePartner.upload} onBusyChange={setTeaserUploading} label="⬆ teaser video · 9:16" />
          <input
            className="input"
            placeholder="or paste a link — Instagram Reel, YouTube, or a direct video file"
            value={teaserVideoUrl ?? ''}
            onChange={(e) => setTeaserVideoUrl(e.target.value || null)}
            style={{ marginTop: 8 }}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
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
                <input value={t.price} onChange={(e) => setTier(i, { price: e.target.value })} inputMode="numeric" />
              </div>
              <div className="field">
                <span>Qty</span>
                <input value={t.quantity} onChange={(e) => setTier(i, { quantity: e.target.value })} inputMode="numeric" />
              </div>
              <button className="icon-round" style={{ alignSelf: 'center', flex: '0 0 auto', background: 'none' }} onClick={() => setTiers((prev) => prev.filter((_, x) => x !== i))} disabled={tiers.length === 1} title="Remove tier"><X size={14} /></button>
            </div>
            <div className="field" style={{ marginTop: 10, marginBottom: 6 }}>
              <span>Ticket description</span>
              <input value={t.description} onChange={(e) => setTier(i, { description: e.target.value })} placeholder="e.g. Best value — entry, welcome drink and access to both stages" />
            </div>
            <div className="form-row" style={{ marginBottom: 6 }}>
              <div className="field">
                <span>Cover charge ₹ (optional)</span>
                <input value={t.coverCharge} onChange={(e) => setTier(i, { coverCharge: e.target.value })} inputMode="numeric" placeholder="e.g. 1000" />
              </div>
              <div className="field">
                <span>Redeemable for (optional)</span>
                <input value={t.coverChargeNote} onChange={(e) => setTier(i, { coverChargeNote: e.target.value })} placeholder="e.g. food & drinks at the venue" />
              </div>
            </div>
            {t.coverCharge.trim() && +t.coverCharge > (+t.price || 0) && (
              <div className="tiny danger-text" style={{ marginBottom: 6 }}>Cover charge can't exceed the ticket price</div>
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
                    <input value={t.lateFeePrice} onChange={(e) => setTier(i, { lateFeePrice: e.target.value })} inputMode="numeric" placeholder="e.g. 200" />
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
              <div className="tiny danger-text" style={{ marginBottom: 6 }}>Set a price after the grace period, or clear the cutoff time</div>
            )}
            <div className="chip-row">
              {Array.from(new Set([...INCLUDE_OPTIONS, ...t.includes])).map((opt) => (
                <button key={opt} className={`chip chip-tap ${t.includes.includes(opt) ? 'on' : ''}`} style={{ fontSize: 12, padding: '4px 11px' }}
                  onClick={() => setTier(i, { includes: t.includes.includes(opt) ? t.includes.filter((x) => x !== opt) : [...t.includes, opt] })}>
                  {opt}{t.includes.includes(opt) && <Check size={12} style={{ marginLeft: 4, verticalAlign: -1 }} />}
                </button>
              ))}
            </div>
            <div className="chip-row" style={{ marginTop: 6 }}>
              <input
                value={customIncludeInputs[i] ?? ''}
                onChange={(e) => setCustomIncludeInputs((prev) => ({ ...prev, [i]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomInclude(i); } }}
                placeholder="Add custom…"
                style={{ fontSize: 12, padding: '4px 10px', flex: 1, minWidth: 100 }}
              />
              <button type="button" className="chip chip-tap" style={{ fontSize: 12, padding: '4px 11px' }} onClick={() => addCustomInclude(i)}>+ Add</button>
            </div>
          </div>
        ))}
        <div className="chip-row" style={{ marginBottom: 6 }}>
          <button className="chip" onClick={() => setTiers((prev) => [...prev, { name: 'VIP', price: '79', quantity: '50', includes: ['Entry', 'Lounge access'], description: '', coverCharge: '', coverChargeNote: '', freeCutoff: '', lateFeePrice: '' }])}>+ Add tier</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="field">
          <span>Event conditions (one per line — shown as bullets)</span>
          <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} />
        </div>
        <h3 style={{ margin: '6px 0 10px' }}>Event rules</h3>
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
            <button className="icon-round" style={{ alignSelf: 'center', flex: '0 0 auto', background: 'none' }} onClick={() => setRules((prev) => prev.filter((_, x) => x !== i))} title="Remove rule"><X size={14} /></button>
          </div>
        ))}
        <div className="chip-row" style={{ marginBottom: 16 }}>
          <button type="button" className="chip" onClick={() => setRules((prev) => [...prev, { title: '', body: '' }])}>+ Add rule</button>
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
            placeholder="Search line-up & partners to add…"
          />
          {lineupSel.length > 0 && (
            <div className="chip-row" style={{ marginTop: 8 }}>
              {lineupSel.map((l) => (
                <button key={l.name} type="button" className="chip on" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => toggleLineup(l)} title="Remove from bill">
                  {l.name} ({l.role}) <X size={13} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 4 }}>Promoters</h3>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Let approved promoters bring free-entry guests, earn a commission on ticket sales through their link, or
          both — you choose per promoter.
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ticket size={13} /> Guest list</span> = free entry, no ticket sold. <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Banknote size={13} /> Paid commission</span> = a % of the ticket price on any sale
                through their link, added on top so it doesn't cut into your revenue (the guest pays the extra, same
                as Prebooze's own commission on that sale).
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
                        <span style={{ fontWeight: 700, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{p.name} {p.verified && <Check size={13} />}</span>
                      </label>
                      {isAllowed && (
                        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, marginLeft: 26 }}>
                          <label className="checkbox-row" style={{ marginBottom: 0 }}>
                            <input type="checkbox" checked={hasGuestList} onChange={() => toggleGuestList(p.slug)} />
                            <span className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ticket size={13} /> Guest list</span>
                          </label>
                          <label className="checkbox-row" style={{ marginBottom: 0 }}>
                            <input type="checkbox" checked={hasCommission} onChange={() => toggleCommission(p.slug)} />
                            <span className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Banknote size={13} /> Paid commission</span>
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
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>SEO options</h3>
        <div className="field">
          <span>SEO title</span>
          <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={`${title || 'Event'} | tickets`} />
        </div>
        <div className="field">
          <span>Meta description (160 chars)</span>
          <input value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} maxLength={160} />
        </div>
        <div className="field">
          <span>URL slug</span>
          <input value={seoSlug} onChange={(e) => setSeoSlug(e.target.value)} placeholder={slug} />
        </div>
        <Accordion title="What happens after submit?">
          Your event goes to admin review (status: Pending). Once approved it's live and bookable. Rejections come
          back with a reason so you can fix & resubmit.
        </Accordion>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-ghost" disabled={saving || mediaUploading} onClick={() => save('draft')}>{mediaUploading ? 'Uploading…' : saving ? 'Saving…' : 'Save draft'}</button>
        <button className="btn btn-pri" disabled={saving || mediaUploading || !canSubmit} onClick={() => save('pending')}>{mediaUploading ? 'Uploading…' : saving ? 'Submitting…' : 'Submit for approval →'}</button>
      </div>
    </div>
  );
}
