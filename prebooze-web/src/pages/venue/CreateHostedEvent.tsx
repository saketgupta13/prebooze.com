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
}
const DEFAULT_TIERS: TierDraft[] = [{ name: 'General', price: '29', quantity: '500', includes: ['Entry', 'Welcome drink'], description: '', coverCharge: '', coverChargeNote: '' }];

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

  const [tiers, setTiers] = useState<TierDraft[]>(DEFAULT_TIERS);

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
    ])
      .then(([ls, ps, orgs, cats, ev]) => {
        setLineups(ls);
        setPromoters(ps);
        setCollaborators(orgs);
        setCategories(cats);
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
          setTiers(ev.tiers.map((t) => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity), includes: t.includes, description: t.description ?? '', coverCharge: t.coverCharge ? String(t.coverCharge) : '', coverChargeNote: t.coverChargeNote ?? '' })));
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

  const slug = useMemo(
    () => (seoSlug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    [seoSlug, title]
  );

  const step1Valid = Boolean(title.trim() && date);
  const tiersValid = tiers.length > 0 && tiers.every((t) => t.name.trim() && +t.price >= 0 && +t.quantity > 0);
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
    })),
    seo: {
      title: seoTitle || `${title} | tickets`,
      description: seoDesc || description.slice(0, 160),
      slug,
      keywords: [],
    },
  });

  const save = async (status: 'draft' | 'pending') => {
    setErr('');
    setSaving(true);
    try {
      await venuePartner.upsertHostedEvent(buildPayload(status));
      navigate('/venue/hosting/events');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save event');
      setSaving(false);
    }
  };

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
      {err && <div className="danger-text small" style={{ margin: '10px 0' }}>✕ {err}</div>}

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
            placeholder="🔍 search verified organizers…"
          />
          <div className="tiny muted-2" style={{ marginTop: 6 }}>
            No invite needed — this event still belongs to your venue's own ledger and dashboard either way. Any
            revenue split with the organizer happens directly between you two.
          </div>
          {organizerId && (
            <button type="button" className="chip on" style={{ marginTop: 8 }} onClick={() => setOrganizerId('')}>
              {collaborators.find((o) => o.id === organizerId)?.brandName} ✕
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 4 }}>Event media</h3>
        <p className="muted small" style={{ marginBottom: 16 }}>All optional — a poster helps your event stand out.</p>
        <div className="field">
          <span>Poster (portrait 3:4)</span>
          <RealUploadBox value={posterUrl} onChange={setPosterUrl} upload={venuePartner.upload} label="⬆ upload poster" style={{ height: 200, width: 160 }} />
        </div>
        <div className="field">
          <span>Gallery photos (optional, up to 6)</span>
          <RealGalleryUploadBox value={galleryUrls} onChange={setGalleryUrls} upload={venuePartner.upload} />
        </div>
        <div className="field">
          <span>Teaser reel (optional)</span>
          <RealVideoUploadBox value={teaserVideoUrl} onChange={setTeaserVideoUrl} upload={venuePartner.upload} label="⬆ teaser video · 9:16" />
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
              <button className="icon-round" style={{ alignSelf: 'center', flex: '0 0 auto', background: 'none' }} onClick={() => setTiers((prev) => prev.filter((_, x) => x !== i))} disabled={tiers.length === 1} title="Remove tier">✕</button>
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
            <div className="chip-row">
              {INCLUDE_OPTIONS.map((opt) => (
                <button key={opt} className={`chip ${t.includes.includes(opt) ? 'on' : ''}`} style={{ fontSize: 12, padding: '4px 11px' }}
                  onClick={() => setTier(i, { includes: t.includes.includes(opt) ? t.includes.filter((x) => x !== opt) : [...t.includes, opt] })}>
                  {opt}{t.includes.includes(opt) ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="chip-row" style={{ marginBottom: 6 }}>
          <button className="chip" onClick={() => setTiers((prev) => [...prev, { name: 'VIP', price: '79', quantity: '50', includes: ['Entry', 'Lounge access'], description: '', coverCharge: '', coverChargeNote: '' }])}>+ Add tier</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="field">
          <span>Event conditions (one per line — shown as bullets)</span>
          <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} />
        </div>
        <h3 style={{ margin: '6px 0 10px' }}>Party rules</h3>
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
            <button className="icon-round" style={{ alignSelf: 'center', flex: '0 0 auto', background: 'none' }} onClick={() => setRules((prev) => prev.filter((_, x) => x !== i))} title="Remove rule">✕</button>
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
            placeholder="🔍 search line-up & partners to add…"
          />
          {lineupSel.length > 0 && (
            <div className="chip-row" style={{ marginTop: 8 }}>
              {lineupSel.map((l) => (
                <button key={l.name} type="button" className="chip on" onClick={() => toggleLineup(l)} title="Remove from bill">
                  {l.name} ({l.role}) ✕
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
                🎟️ Guest list = free entry, no ticket sold. 💰 Paid commission = a % of the ticket price on any sale
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
        <button className="btn btn-ghost" disabled={saving} onClick={() => save('draft')}>{saving ? 'Saving…' : 'Save draft'}</button>
        <button className="btn btn-pri" disabled={saving || !canSubmit} onClick={() => save('pending')}>{saving ? 'Submitting…' : 'Submit for approval →'}</button>
      </div>
    </div>
  );
}
