import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  liveEvents, liveVenues, liveOrganizers, liveLineups, livePromoters, liveCategories, LiveApiError,
  type LiveEvent, type LiveEventInput, type LiveVenue, type LiveOrganizer, type LiveLineup, type LivePromoter, type LiveCategory,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import { LiveLocationPicker, MultiSelectSearch, SingleSelectSearch } from '../components/ui';
import SeoFields, { emptySeo } from '../components/SeoFields';
import WysiwygEditor from '../components/WysiwygEditor';
import RealImageUpload from '../components/RealImageUpload';
import RealVideoUpload from '../components/RealVideoUpload';

const INCLUDE_OPTIONS = ['Entry', 'Welcome drink', 'Food coupon', 'Standing zone', 'Lounge access', '2 drinks', 'Meet & greet'];

/** `found.date` is a UTC ISO string ("...T10:30:00.000Z") — a plain
 * `.slice(0, 16)` fed straight into a <input type="datetime-local"> shows
 * that raw UTC clock time as if it were already local, which is why an
 * event set for 4 PM IST reopened as 10 AM. datetime-local always means
 * local wall-clock time, so this has to go through the local Date getters
 * (not the UTC ones) to round-trip correctly. */
const toLocalDateTimeInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface RuleDraft { title: string; body: string }
const DEFAULT_RULES: RuleDraft[] = [
  { title: 'Dress code', body: 'Smart casual — no flip-flops or sleeveless shirts.' },
  { title: 'Food & drinks', body: 'Full bar inside. Outside food & drinks not permitted.' },
  { title: 'Prohibited items', body: 'No weapons, illegal substances or professional cameras.' },
];

type EditorTab = 'basics' | 'tickets' | 'media' | 'rules' | 'commission' | 'lineup' | 'seo';
const TABS: { key: EditorTab; label: string }[] = [
  { key: 'basics', label: '1 · Basics' },
  { key: 'tickets', label: '2 · Tickets' },
  { key: 'media', label: '3 · Media' },
  { key: 'rules', label: '4 · Rules' },
  { key: 'commission', label: '5 · Commission' },
  { key: 'lineup', label: '6 · Line-up & Promoters' },
  { key: 'seo', label: '7 · SEO' },
];

interface TierDraft { id?: string; name: string; price: string; quantity: string; description: string; includes: string[]; sold?: number; coverCharge: string; coverChargeNote: string; }

const emptyTier = (): TierDraft => ({ name: 'General', price: '450', quantity: '200', description: '', includes: ['Entry'], coverCharge: '', coverChargeNote: '' });

/** Real, single event editor — replaces the old mock EventEditor.tsx.
 * Backs the whole real create/edit flow via OrganizerService.adminUpsertEvent.
 * Poster/gallery/teaser/social images all upload immediately (RealImageUpload
 * hits the generic media endpoint, no event id needed) and are held in local
 * state until the main Save button submits them along with everything else.
 * A brand-new event must be saved once to get a real id before commission
 * and approve/reject become available — those genuinely require an id that
 * only exists after the first save. */
export default function EventEditorReal() {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [tab, setTab] = useState<EditorTab>('basics');
  const [venues, setVenues] = useState<LiveVenue[]>([]);
  const [organizers, setOrganizers] = useState<LiveOrganizer[]>([]);
  const [lineups, setLineups] = useState<LiveLineup[]>([]);
  const [promoters, setPromoters] = useState<LivePromoter[]>([]);
  const [categories, setCategories] = useState<LiveCategory[]>([]);
  const [existing, setExisting] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [venueId, setVenueId] = useState('');
  // Private-address mode — no registered Venue at all, just a city/locality.
  // Guests only ever see "{locality}, {city}"; the organizer is responsible
  // for telling booked guests the real address themselves.
  const [privateAddress, setPrivateAddress] = useState(false);
  const [privateLoc, setPrivateLoc] = useState({ country: 'India', state: '', city: '' });
  const [privateLocality, setPrivateLocality] = useState('');
  const [organizerId, setOrganizerId] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [durationHrs, setDurationHrs] = useState('4');
  const [ageLimit, setAgeLimit] = useState('18+');
  const [tiers, setTiers] = useState<TierDraft[]>([emptyTier()]);
  const [conditions, setConditions] = useState('');
  const [rules, setRules] = useState<RuleDraft[]>(DEFAULT_RULES);
  const [commission, setCommissionState] = useState('10');
  const [lineupItems, setLineupItems] = useState<{ name: string; role: string }[]>([]);
  const [allowedPromoters, setAllowedPromoters] = useState<string[]>([]);
  // Two independent modes, picked per promoter: Guest list (free entry) and
  // Paid commission (revenue share % on ticket sales). Either, both, or
  // (rare) neither once a promoter is added to allowedPromoters.
  const [guestListPromoters, setGuestListPromoters] = useState<string[]>([]);
  const [commissionPromoters, setCommissionPromoters] = useState<string[]>([]);
  const handleAllowedPromotersChange = (next: string[]) => {
    const added = next.filter((s) => !allowedPromoters.includes(s));
    setGuestListPromoters((g) => [...g.filter((s) => next.includes(s)), ...added]);
    setCommissionPromoters((c) => c.filter((s) => next.includes(s)));
    setAllowedPromoters(next);
  };
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoCap, setPromoCap] = useState('50');
  const [promoCutoff, setPromoCutoff] = useState('23:00');
  const [perHead, setPerHead] = useState(false);
  const [perHeadAmt, setPerHeadAmt] = useState('100');
  const [allowTeams, setAllowTeams] = useState(false);
  // Negotiated per promoter, not one flat rate for the event — slug -> %.
  // Only applies for promoters with Paid commission on (commissionPromoters).
  const [revenueShare, setRevenueShare] = useState<Record<string, string>>({});
  const [seo, setSeo] = useState(emptySeo());
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [teaserVideoUrl, setTeaserVideoUrl] = useState('');
  const [socialPostUrl, setSocialPostUrl] = useState('');
  const [socialStoryUrl, setSocialStoryUrl] = useState('');

  useEffect(() => {
    if (!token) return;
    Promise.all([liveVenues.list(), liveOrganizers.list(), liveLineups.list(), livePromoters.list(), liveCategories.list()])
      .then(([v, o, l, p, c]) => {
        setVenues(v);
        setOrganizers(o);
        setLineups(l);
        setPromoters(p);
        setCategories(c);
        if (!isCreate) {
          liveEvents.list().then((all) => {
            const found = all.find((e) => e.id === id);
            if (found) {
              setExisting(found);
              setTitle(found.title);
              setDescription(found.description ?? '');
              setCategory(found.category);
              setSubCategory(found.subCategory ?? '');
              if (found.venueId) {
                setVenueId(found.venueId);
              } else {
                setPrivateAddress(true);
                setPrivateLoc({ country: 'India', state: '', city: found.privateCity ?? '' });
                setPrivateLocality(found.privateLocality ?? '');
              }
              setOrganizerId(found.organizerId ?? '');
              setDateTime(found.date ? toLocalDateTimeInput(found.date) : '');
              setDurationHrs(String(found.durationHrs ?? 4));
              setAgeLimit(found.ageLimit ?? '18+');
              setTiers(
                found.tiers.length
                  ? found.tiers.map((t) => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity), description: t.description ?? '', includes: t.includes ?? [], sold: t.sold, coverCharge: t.coverCharge ? String(t.coverCharge) : '', coverChargeNote: t.coverChargeNote ?? '' }))
                  : [emptyTier()],
              );
              setConditions((found.conditions ?? []).join('\n'));
              setRules(found.rules?.length ? found.rules : DEFAULT_RULES);
              setCommissionState(found.commission == null ? '' : String(found.commission));
              setLineupItems(found.lineup ?? []);
              setAllowedPromoters(found.promoterConfig?.allowedPromoters ?? []);
              // missing guestListPromoters (events saved before this field
              // existed) defaults to every allowed promoter — preserves what
              // was actually live rather than silently un-checking promoters
              // who are still earning per-head payouts today
              setGuestListPromoters(found.promoterConfig?.guestListPromoters ?? found.promoterConfig?.allowedPromoters ?? []);
              setPromoEnabled(found.promoterConfig?.enabled ?? false);
              setPromoCap(String(found.promoterConfig?.cap ?? 50));
              setPromoCutoff(found.promoterConfig?.cutoff ?? '23:00');
              setPerHead(found.promoterConfig?.perHeadPayout ?? false);
              setPerHeadAmt(String(found.promoterConfig?.perHeadAmount ?? 100));
              setAllowTeams(found.promoterConfig?.allowTeams ?? false);
              setRevenueShare(Object.fromEntries(Object.entries(found.promoterConfig?.revenueShare ?? {}).map(([slug, pct]) => [slug, String(pct)])));
              setCommissionPromoters(Object.entries(found.promoterConfig?.revenueShare ?? {}).filter(([, pct]) => pct > 0).map(([slug]) => slug));
              setSeo(found.seo ? { ...found.seo, keywords: Array.isArray(found.seo.keywords) ? found.seo.keywords.join(', ') : found.seo.keywords } : emptySeo());
              setPosterUrl(found.posterUrl ?? null);
              setGalleryUrls(found.galleryUrls ?? []);
              setTeaserVideoUrl(found.teaserVideoUrl ?? '');
              setSocialPostUrl(found.socialBanners?.postUrl ?? '');
              setSocialStoryUrl(found.socialBanners?.storyUrl ?? '');
            }
            setLoading(false);
          });
        } else {
          setVenueId(v[0]?.id ?? '');
          setOrganizerId(o[0]?.id ?? '');
          setLoading(false);
        }
      })
      .catch((e) => { setErr(e instanceof LiveApiError ? e.message : 'Failed to load'); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const gate = useLiveGate(isCreate ? 'Create event (live)' : `Edit event (live)`, session);
  if (gate) return gate;

  const canSave = title.trim() && (privateAddress ? privateLoc.city && privateLocality.trim() : venueId) && organizerId && (isCreate ? dateTime.trim() : true);

  const buildInput = (): Omit<LiveEventInput, 'id'> => ({
    organizerId,
    title: title.trim(),
    description,
    category,
    subCategory: subCategory || undefined,
    ageLimit,
    date: dateTime ? new Date(dateTime).toISOString() : undefined,
    durationHrs: parseFloat(durationHrs) || undefined,
    ...(privateAddress ? { privateCity: privateLoc.city, privateLocality: privateLocality.trim() } : { venueId }),
    conditions: conditions.split('\n').map((s) => s.trim()).filter(Boolean),
    rules: rules.filter((r) => r.title.trim() || r.body.trim()),
    lineup: lineupItems,
    seo,
    promoterConfig: {
      enabled: promoEnabled,
      cap: parseInt(promoCap, 10) || 0,
      cutoff: promoCutoff,
      allowedPromoters,
      guestListPromoters,
      perHeadPayout: perHead,
      perHeadAmount: parseInt(perHeadAmt, 10) || 0,
      allowTeams,
      revenueShare: Object.fromEntries(
        allowedPromoters
          .filter((slug) => commissionPromoters.includes(slug))
          .map((slug) => [slug, parseInt(revenueShare[slug], 10) || 0] as const)
          .filter(([, pct]) => pct > 0)
      ),
    },
    posterUrl,
    galleryUrls,
    teaserVideoUrl: teaserVideoUrl || null,
    socialBanners: { postUrl: socialPostUrl || undefined, storyUrl: socialStoryUrl || undefined },
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      price: parseInt(t.price, 10) || 0,
      quantity: parseInt(t.quantity, 10) || 0,
      description: t.description || undefined,
      includes: t.includes,
      coverCharge: parseInt(t.coverCharge, 10) || 0,
      coverChargeNote: t.coverChargeNote.trim() || undefined,
    })),
  });

  const save = async () => {
    if (!canSave) {
      setErr('Title, a venue (or city + locality for a private event), organizer (and date, for a new event) are required');
      setTab('basics');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      if (isCreate) {
        const created = await liveEvents.create(buildInput());
        navigate(`/events/${created.id}`);
      } else {
        const updated = await liveEvents.update(id!, buildInput());
        setExisting(updated);
        setMsg('Saved ✓');
      }
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!existing) return;
    try { setExisting(await liveEvents.approve(existing.id)); setMsg('Approved ✓'); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed'); }
  };
  const reject = async () => {
    if (!existing) return;
    try {
      setExisting(await liveEvents.reject(existing.id, rejectReason.trim()));
      setShowReject(false);
      setMsg('Rejected');
    } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed'); }
  };
  const saveCommission = async () => {
    if (!existing) return;
    const v = commission.trim() === '' ? null : parseFloat(commission);
    if (v != null && (Number.isNaN(v) || v < 0 || v > 100)) { setErr('Commission must be 0-100'); return; }
    try { setExisting(await liveEvents.setCommission(existing.id, v)); setMsg('Commission saved ✓'); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed'); }
  };
  const togglePaidOut = async () => {
    if (!existing) return;
    try { setExisting(await liveEvents.setPaidOut(existing.id, !existing.paidOut)); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed'); }
  };
  const toggleSalesPaused = async () => {
    if (!existing) return;
    try { setExisting(await liveEvents.setSalesPaused(existing.id, !existing.salesPaused)); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed'); }
  };
  const patchTier = (i: number, p: Partial<TierDraft>) => setTiers((prev) => prev.map((t, x) => (x === i ? { ...t, ...p } : t)));
  const patchRule = (i: number, p: Partial<RuleDraft>) => setRules((prev) => prev.map((r, x) => (x === i ? { ...r, ...p } : r)));

  if (loading) return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/events" style={{ fontSize: 13 }}>← Events</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{isCreate ? 'Create event' : title}</h1>
        {existing && <span className="tag">{existing.status}</span>}
        <div style={{ flex: 1 }} />
        <span className="tiny muted">signed in as {session.staffName || 'staff'}</span>
        <button className="btn btn-ghost btn-sm" onClick={session.logout}>Sign out</button>
      </div>

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {msg && <div className="tiny" style={{ color: 'var(--green)' }}>{msg}</div>}

      {existing && existing.status === 'pending' && (
        <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ marginRight: 8 }}>Pending approval</b>
          <button className="btn btn-pri btn-sm" onClick={approve}>Approve ✓</button>
          {showReject ? (
            <>
              <input className="input" style={{ width: 200 }} placeholder="reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <button className="btn btn-danger btn-sm" onClick={reject}>Confirm reject</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReject(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowReject(true)}>Reject</button>
          )}
        </div>
      )}
      {existing && existing.status === 'approved' && (
        <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={togglePaidOut}>{existing.paidOut ? 'Mark unpaid' : 'Mark paid out'}</button>
          <button className="btn btn-ghost btn-sm" onClick={toggleSalesPaused}>{existing.salesPaused ? 'Resume sales' : 'Pause sales'}</button>
        </div>
      )}
      {existing?.hostedByVenue && (
        <div className="card" style={{ borderColor: 'var(--amber, #d99a2b)', color: 'var(--amber, #d99a2b)' }}>
          🎪 This event is hosted by <b>{existing.venue?.name ?? 'a venue'}</b>, not a regular organizer. Approve/reject/commission/paid-out above are safe to use as normal, but the full "Save" form below requires
          picking an organizer — only use it if you actually mean to attach this event to one.
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'basics' && (
        <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field" style={{ gridColumn: '1 / 3' }}>
            <label>Event title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>
          <div className="field" style={{ gridColumn: '1 / 3' }}>
            <label>Description</label>
            <WysiwygEditor value={description} onChange={setDescription} minHeight={100} />
          </div>
          <div className="field">
            <label>Category</label>
            <select
              className="input"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setSubCategory(''); }}
            >
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Sub-category</label>
            <select className="input" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} disabled={!category}>
              <option value="">None</option>
              {(categories.find((c) => c.name === category)?.subs ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Age limit</label>
            <select className="input" value={ageLimit} onChange={(e) => setAgeLimit(e.target.value)}>
              <option>All ages</option>
              <option>18+</option>
              <option>21+</option>
            </select>
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
              <input type="checkbox" checked={privateAddress} onChange={(e) => setPrivateAddress(e.target.checked)} />
              Keep exact address private — organizer will share it with guests themselves
            </label>
          </div>
          {privateAddress ? (
            <div className="field">
              <label>City &amp; locality</label>
              <LiveLocationPicker value={privateLoc} onChange={setPrivateLoc} />
              <input
                className="input"
                style={{ marginTop: 8 }}
                value={privateLocality}
                onChange={(e) => setPrivateLocality(e.target.value)}
                placeholder="Locality, e.g. Banjara Hills"
              />
              <div className="tiny muted" style={{ marginTop: 6 }}>
                Guests will only ever see "{privateLocality || 'locality'}, {privateLoc.city || 'city'}" — no venue name, no address, no map.
              </div>
            </div>
          ) : (
            <div className="field">
              <label>Venue</label>
              <SingleSelectSearch
                items={venues.map((v) => ({ id: v.id, label: v.name, sub: v.city }))}
                selectedId={venueId}
                onChange={setVenueId}
                placeholder="🔍 search venues…"
              />
            </div>
          )}
          <div className="field">
            <label>Organizer</label>
            <SingleSelectSearch
              items={organizers.map((o) => ({ id: o.id, label: o.brandName }))}
              selectedId={organizerId}
              onChange={setOrganizerId}
              placeholder="🔍 search organizers…"
            />
          </div>
          <div className="field">
            <label>Date &amp; time</label>
            <input className="input" type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
          </div>
          <div className="field">
            <label>Duration (hours)</label>
            <input className="input" inputMode="decimal" value={durationHrs} onChange={(e) => setDurationHrs(e.target.value)} />
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="stack" style={{ gap: 8 }}>
          {tiers.map((t, i) => (
            <div key={i} className="card" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '10px 12px', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 2, minWidth: 120 }}>
                <label>Tier name</label>
                <input className="input" value={t.name} onChange={(e) => patchTier(i, { name: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 80 }}>
                <label>Price ₹</label>
                <input className="input" inputMode="numeric" value={t.price} onChange={(e) => patchTier(i, { price: e.target.value.replace(/\D/g, '') })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 80 }}>
                <label>Qty</label>
                <input className="input" inputMode="numeric" value={t.quantity} onChange={(e) => patchTier(i, { quantity: e.target.value.replace(/\D/g, '') })} />
              </div>
              {t.sold != null && <span className="tiny muted" style={{ paddingBottom: 10 }}>{t.sold} sold</span>}
              <button
                className="btn btn-danger btn-sm"
                disabled={tiers.length === 1 || (t.sold ?? 0) > 0}
                title={(t.sold ?? 0) > 0 ? 'Tier has sold tickets' : 'Remove tier'}
                onClick={() => setTiers((prev) => prev.filter((_, x) => x !== i))}
              >
                ✕
              </button>
              <div className="field" style={{ flexBasis: '100%' }}>
                <label>Ticket description — shown under this tier on the event page</label>
                <input className="input" value={t.description} onChange={(e) => patchTier(i, { description: e.target.value })} placeholder="e.g. Best value — entry, welcome drink and access to both stages" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>Cover charge ₹ (optional)</label>
                <input className="input" inputMode="numeric" value={t.coverCharge} onChange={(e) => patchTier(i, { coverCharge: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 1000" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>Redeemable for (optional)</label>
                <input className="input" value={t.coverChargeNote} onChange={(e) => patchTier(i, { coverChargeNote: e.target.value })} placeholder="e.g. food & drinks at the venue" />
              </div>
              {t.coverCharge.trim() && +t.coverCharge > (+t.price || 0) && (
                <div className="tiny" style={{ color: 'var(--red)', flexBasis: '100%' }}>Cover charge can't exceed the ticket price</div>
              )}
              {t.coverCharge.trim() && +t.coverCharge > 0 && !(+t.coverCharge > (+t.price || 0)) && (
                <div className="tiny muted" style={{ flexBasis: '100%' }}>
                  Guests see this ticket includes ₹{t.coverCharge} redeemable at the venue{t.coverChargeNote.trim() ? ` (${t.coverChargeNote.trim()})` : ''}.
                </div>
              )}
              <div className="field" style={{ flexBasis: '100%' }}>
                <label>What's included</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {INCLUDE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`chip ${t.includes.includes(opt) ? 'on' : ''}`}
                      onClick={() => patchTier(i, { includes: t.includes.includes(opt) ? t.includes.filter((x) => x !== opt) : [...t.includes, opt] })}
                    >
                      {opt}{t.includes.includes(opt) ? ' ✓' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ width: 'fit-content' }} onClick={() => setTiers((prev) => [...prev, emptyTier()])}>+ Add tier</button>
        </div>
      )}

      {tab === 'media' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b>Poster</b>
            <RealImageUpload value={posterUrl} onChange={setPosterUrl} height={200} width={160} label="⬆ poster 3:4" />
            <div className="tiny hint">Saved along with the rest of the form — click {isCreate ? 'Create event' : 'Save changes'} below once you've uploaded it.</div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b>Gallery photos (optional, up to 6)</b>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {galleryUrls.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <div style={{ width: 110, height: 110, borderRadius: 10, backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid var(--green)' }} />
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px' }}
                    onClick={() => setGalleryUrls((prev) => prev.filter((_, x) => x !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {galleryUrls.length < 6 && (
                <RealImageUpload value={null} onChange={(url) => setGalleryUrls((prev) => [...prev, url])} height={110} width={110} label="+ add photo" />
              )}
            </div>
            <div className="tiny hint">Optional — shown as a photo gallery on the guest event page.</div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b>Teaser reel (optional)</b>
            <RealVideoUpload value={teaserVideoUrl || null} onChange={setTeaserVideoUrl} label="⬆ teaser video · 9:16" />
            <div className="tiny hint">Optional — a short vertical clip, plays on the guest event page.</div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b>Shareable promo images (optional)</b>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="tiny muted" style={{ marginBottom: 4 }}>Instagram post · 1:1</div>
                <RealImageUpload value={socialPostUrl || null} onChange={setSocialPostUrl} height={110} width={110} label="⬆ post 1:1" />
              </div>
              <div>
                <div className="tiny muted" style={{ marginBottom: 4 }}>Instagram story · 9:16</div>
                <RealImageUpload value={socialStoryUrl || null} onChange={setSocialStoryUrl} height={160} width={90} label="⬆ story 9:16" />
              </div>
            </div>
            <div className="tiny hint">Optional — ready-to-post promo images shown on the guest page's Share panel.</div>
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label>Event conditions (one per line — bullets on the guest page)</label>
            <textarea className="input" style={{ minHeight: 120, resize: 'vertical' }} value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder={'Photo ID required\nNo re-entry'} />
          </div>
          <div>
            <b style={{ fontSize: 13 }}>Party rules (accordions on the event page)</b>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              {rules.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="field" style={{ flex: '0 0 180px' }}>
                    <label>Rule title</label>
                    <input className="input" value={r.title} onChange={(e) => patchRule(i, { title: e.target.value })} placeholder="e.g. Age policy" />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 160 }}>
                    <label>Details</label>
                    <input className="input" value={r.body} onChange={(e) => patchRule(i, { body: e.target.value })} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setRules((prev) => prev.filter((_, x) => x !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ width: 'fit-content' }} onClick={() => setRules((prev) => [...prev, { title: '', body: '' }])}>+ Add rule</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'commission' && (
        existing ? (
          <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 160 }}>Platform commission</span>
            <input className="input" style={{ width: 80, textAlign: 'center' }} value={commission} onChange={(e) => setCommissionState(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="unset" />
            <span className="muted">%</span>
            <button className="btn btn-pri btn-sm" onClick={saveCommission}>Save commission</button>
          </div>
        ) : (
          <div className="card muted">Save the event once to set its commission.</div>
        )
      )}

      {tab === 'lineup' && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="field">
            <label>Line-up — pick from the real Line-ups directory (stored as name/role on the event)</label>
            <MultiSelectSearch
              chipIcon="🎤"
              placeholder="Search registered line-ups by name…"
              emptyHint="No line-ups registered yet."
              items={lineups.map((l) => ({ id: l.name, label: l.name, sub: l.category, disabled: !l.verified, disabledLabel: '(pending verification)' }))}
              selectedIds={lineupItems.map((l) => l.name)}
              onChange={(names) => setLineupItems(names.map((n) => lineupItems.find((l) => l.name === n) ?? { name: n, role: 'Performer' }))}
            />
          </div>
          <div className="hr" style={{ margin: '4px 0' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={promoEnabled} onChange={(e) => setPromoEnabled(e.target.checked)} />
            <b style={{ fontSize: 13 }}>Enable promoters for this event</b>
          </label>
          {!promoEnabled && <div className="tiny muted" style={{ marginLeft: 24 }}>Check this to pick which promoters can run guest lists, earn paid commission, or both.</div>}
          {promoEnabled && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Free-entry cap (total passes)</label>
                  <input className="input" inputMode="numeric" value={promoCap} onChange={(e) => setPromoCap(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Free entry valid before</label>
                  <input className="input" type="time" value={promoCutoff} onChange={(e) => setPromoCutoff(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Promoters allowed on this event</label>
                <MultiSelectSearch
                  chipIcon="📣"
                  placeholder="Search registered promoters by name…"
                  emptyHint="No promoters registered yet."
                  items={promoters.map((p) => ({ id: p.slug, label: p.name, sub: p.city, disabled: !p.verified, disabledLabel: '(unverified)' }))}
                  selectedIds={allowedPromoters}
                  onChange={handleAllowedPromotersChange}
                />
              </div>
              {allowedPromoters.length > 0 && (
                <div className="field">
                  <label>How each promoter promotes this event</label>
                  <div className="tiny muted" style={{ marginBottom: 8 }}>
                    🎟️ Guest list = free entry, no ticket sold. 💰 Paid commission = a % of the ticket price on any
                    sale through their link, added on top (guest-funded, same as Prebooze's own commission on that
                    sale) so it never cuts into the organizer's revenue. Pick either, both, or neither.
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {allowedPromoters.map((slug) => {
                      const p = promoters.find((pp) => pp.slug === slug);
                      const hasGuestList = guestListPromoters.includes(slug);
                      const hasCommission = commissionPromoters.includes(slug);
                      return (
                        <div key={slug} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                          <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>{p?.name ?? slug}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={hasGuestList}
                                onChange={() => setGuestListPromoters((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]))}
                              />
                              <span className="small">🎟️ Guest list</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={hasCommission}
                                onChange={() => setCommissionPromoters((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]))}
                              />
                              <span className="small">💰 Paid commission</span>
                            </label>
                            {hasCommission && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  className="input"
                                  style={{ width: 70 }}
                                  inputMode="numeric"
                                  value={revenueShare[slug] ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                                    setRevenueShare((prev) => ({ ...prev, [slug]: v }));
                                  }}
                                  placeholder="0"
                                />
                                <span className="small muted">%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={perHead} onChange={(e) => setPerHead(e.target.checked)} />
                <span>Pay promoters per verified arrival <span className="muted">(applies to promoters with Guest list checked above)</span></span>
              </label>
              {perHead && (
                <div className="field" style={{ maxWidth: 200, marginLeft: 24 }}>
                  <label>₹ per confirmed check-in</label>
                  <input className="input" inputMode="numeric" value={perHeadAmt} onChange={(e) => setPerHeadAmt(e.target.value.replace(/\D/g, ''))} />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={allowTeams} onChange={(e) => setAllowTeams(e.target.checked)} />
                <span>Allow promoter teams / sub-promoters</span>
              </label>
            </>
          )}
        </div>
      )}

      {tab === 'seo' && (
        <SeoFields seo={seo} onChange={setSeo} slug={`/events/${(title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} fallbackTitle={`${title || 'Event'} tickets`} />
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-pri" disabled={saving || !canSave} onClick={save}>{saving ? 'Saving…' : isCreate ? 'Create event' : 'Save changes'}</button>
      </div>
    </div>
  );
}
