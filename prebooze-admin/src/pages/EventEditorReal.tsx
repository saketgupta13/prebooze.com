import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  liveEvents, liveVenues, liveOrganizers, liveLineups, livePromoters, liveCategories, LiveApiError,
  type LiveEvent, type LiveEventInput, type LiveVenue, type LiveOrganizer, type LiveLineup, type LivePromoter, type LiveCategory,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import { MultiSelectSearch } from '../components/ui';
import SeoFields, { emptySeo } from '../components/SeoFields';
import WysiwygEditor from '../components/WysiwygEditor';
import RealImageUpload from '../components/RealImageUpload';

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

interface TierDraft { id?: string; name: string; price: string; quantity: string; description: string; sold?: number; }

const emptyTier = (): TierDraft => ({ name: 'General', price: '450', quantity: '200', description: '' });

/** Real, single event editor — replaces the old mock EventEditor.tsx.
 * Backs the whole real create/edit flow via OrganizerService.adminUpsertEvent.
 * A brand-new event must be saved once (Basics/Tickets/Rules/Lineup/SEO) to
 * get a real id before poster upload, commission, and approve/reject become
 * available — those all require an id that only exists after the first save. */
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
  const [venueId, setVenueId] = useState('');
  const [organizerId, setOrganizerId] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [durationHrs, setDurationHrs] = useState('4');
  const [ageLimit, setAgeLimit] = useState('18+');
  const [tiers, setTiers] = useState<TierDraft[]>([emptyTier()]);
  const [conditions, setConditions] = useState('');
  const [commission, setCommissionState] = useState('10');
  const [lineupItems, setLineupItems] = useState<{ name: string; role: string }[]>([]);
  const [allowedPromoters, setAllowedPromoters] = useState<string[]>([]);
  const [seo, setSeo] = useState(emptySeo());

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
              setVenueId(found.venueId);
              setOrganizerId(found.organizerId);
              setDateTime(found.date ? found.date.slice(0, 16) : '');
              setDurationHrs(String(found.durationHrs ?? 4));
              setAgeLimit(found.ageLimit ?? '18+');
              setTiers(
                found.tiers.length
                  ? found.tiers.map((t) => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity), description: t.description ?? '', sold: t.sold }))
                  : [emptyTier()],
              );
              setConditions((found.conditions ?? []).join('\n'));
              setCommissionState(found.commission == null ? '' : String(found.commission));
              setLineupItems(found.lineup ?? []);
              setAllowedPromoters(found.promoterConfig?.allowedPromoters ?? []);
              setSeo(found.seo ? { ...found.seo, keywords: Array.isArray(found.seo.keywords) ? found.seo.keywords.join(', ') : found.seo.keywords } : emptySeo());
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

  const canSave = title.trim() && venueId && organizerId && (isCreate ? dateTime.trim() : true);

  const buildInput = (): Omit<LiveEventInput, 'id'> => ({
    organizerId,
    title: title.trim(),
    description,
    category,
    ageLimit,
    date: dateTime ? new Date(dateTime).toISOString() : undefined,
    durationHrs: parseFloat(durationHrs) || undefined,
    venueId,
    conditions: conditions.split('\n').map((s) => s.trim()).filter(Boolean),
    lineup: lineupItems,
    seo,
    promoterConfig: {
      enabled: allowedPromoters.length > 0,
      cap: existing?.promoterConfig?.cap ?? 50,
      cutoff: existing?.promoterConfig?.cutoff ?? '23:00',
      allowedPromoters,
      perHeadPayout: existing?.promoterConfig?.perHeadPayout ?? false,
      perHeadAmount: existing?.promoterConfig?.perHeadAmount ?? 0,
      allowTeams: existing?.promoterConfig?.allowTeams ?? false,
    },
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      price: parseInt(t.price, 10) || 0,
      quantity: parseInt(t.quantity, 10) || 0,
      description: t.description || undefined,
    })),
  });

  const save = async () => {
    if (!canSave) {
      setErr('Title, venue, organizer (and date, for a new event) are required');
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
  const setPoster = async (url: string) => {
    if (!existing) return;
    try { setExisting(await liveEvents.setPoster(existing.id, url)); setMsg('Poster saved ✓'); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed'); }
  };

  const patchTier = (i: number, p: Partial<TierDraft>) => setTiers((prev) => prev.map((t, x) => (x === i ? { ...t, ...p } : t)));

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
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
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
            <label>Venue</label>
            <select className="input" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.city}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Organizer</label>
            <select className="input" value={organizerId} onChange={(e) => setOrganizerId(e.target.value)}>
              {organizers.map((o) => <option key={o.id} value={o.id}>{o.brandName}</option>)}
            </select>
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
                <label>What's included</label>
                <input className="input" value={t.description} onChange={(e) => patchTier(i, { description: e.target.value })} placeholder="e.g. Entry + 1 welcome drink" />
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ width: 'fit-content' }} onClick={() => setTiers((prev) => [...prev, emptyTier()])}>+ Add tier</button>
        </div>
      )}

      {tab === 'media' && (
        existing ? (
          <div className="stack" style={{ gap: 10 }}>
            <RealImageUpload value={existing.posterUrl} onChange={setPoster} height={200} width={160} label="⬆ poster 3:4" />
            <div className="tiny hint">Real, persisted upload — shows on guest cards &amp; the event page. Gallery/teaser reel/social banners aren't backed by real storage yet, so they're not here.</div>
          </div>
        ) : (
          <div className="card muted">Save the event once (Basics tab) to get a real event id before uploading a poster.</div>
        )
      )}

      {tab === 'rules' && (
        <div className="field">
          <label>Event conditions (one per line — bullets on the guest page)</label>
          <textarea className="input" style={{ minHeight: 120, resize: 'vertical' }} value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder={'Photo ID required\nNo re-entry'} />
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
          <div className="field" style={{ marginTop: 6 }}>
            <label>Promoters allowed to run guest lists for this event</label>
            <MultiSelectSearch
              chipIcon="📣"
              placeholder="Search registered promoters by name…"
              emptyHint="No promoters registered yet."
              items={promoters.map((p) => ({ id: p.slug, label: p.name, sub: p.city, disabled: !p.verified, disabledLabel: '(unverified)' }))}
              selectedIds={allowedPromoters}
              onChange={setAllowedPromoters}
            />
          </div>
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
