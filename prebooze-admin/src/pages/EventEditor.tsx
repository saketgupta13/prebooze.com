import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { CATEGORY_OPTIONS, CATEGORY_SUBS, fmt } from '../store/data';
import { EVENT_STATUS, GalleryPicker, ImagePicker, Tag, VideoPicker } from '../components/ui';
import SeoFields, { emptySeo } from '../components/SeoFields';
import type { AdminEvent, Tier } from '../types';

type EditorTab = 'basics' | 'tickets' | 'media' | 'rules' | 'commission' | 'lineup' | 'seo';
const TABS: { key: EditorTab; label: string }[] = [
  { key: 'basics', label: '1 · Basics' },
  { key: 'tickets', label: '2 · Tickets' },
  { key: 'media', label: '3 · Media' },
  { key: 'rules', label: '4 · Rules' },
  { key: 'commission', label: '5 · Commission' },
  { key: 'lineup', label: '6 · Line-up' },
  { key: 'seo', label: '7 · SEO' },
];

const EMPTY_EVENT: AdminEvent = {
  id: '',
  title: '',
  category: 'Concerts',
  venue: '',
  date: '',
  time: '8:00 PM',
  organizer: '',
  city: 'Austin',
  status: 'draft',
  sold: 0,
  cap: 0,
  revenue: 0,
  commission: 10,
  tiers: [{ name: 'General', price: 450, qty: 200, sold: 0, description: 'Entry + 1 welcome drink' }],
  description: '',
  rules: 'Photo ID required\nNo re-entry',
  lineup: '',
  hasBanner: false,
};

/** Admin event editor — also serves /events/create (same 6-step layout the organizer console uses). */
export default function EventEditor() {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();
  const { events, venues, organizers, settings, addEvent, updateEvent, approveEvent, rejectEvent, toast } = useAdmin();
  const [tab, setTab] = useState<EditorTab>('basics');
  const [draft, setDraft] = useState<AdminEvent>(() => ({
    ...EMPTY_EVENT,
    venue: venues[0]?.name ?? '',
    city: venues[0]?.city ?? 'Austin',
    organizer: organizers.find((o) => o.status === 'approved')?.name ?? '',
  }));

  const stored = isCreate ? undefined : events.find((e) => e.id === id);
  if (!isCreate && !stored) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Event not found</h1>
        <Link to="/events" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Events</Link>
      </div>
    );
  }
  const event = isCreate ? draft : (stored as AdminEvent);

  const patch = (p: Partial<AdminEvent>) => {
    if (isCreate) setDraft((d) => ({ ...d, ...p }));
    else updateEvent(event.id, p);
  };

  const patchTier = (i: number, p: Partial<Tier>) => {
    const tiers = event.tiers.map((t, x) => (x === i ? { ...t, ...p } : t));
    patch({ tiers, cap: tiers.reduce((a, t) => a + (+t.qty || 0), 0) });
  };

  const commission = event.commission ?? 10;
  const previewPrice = event.tiers[Math.min(1, event.tiers.length - 1)]?.price ?? 450;
  const gstAmt = (settings.bookingFee * settings.gstPct) / 100;
  const guestPays = previewPrice + settings.bookingFee + gstAmt;
  const platformKeeps = (previewPrice * commission) / 100 + settings.bookingFee;
  const organizerNets = previewPrice - (previewPrice * commission) / 100;

  const canSave = event.title.trim() && event.venue && event.organizer && (isCreate ? event.date.trim() : true);

  const save = (status?: AdminEvent['status']) => {
    if (isCreate) {
      if (!canSave) {
        toast('Fill in title, date, venue and organizer first');
        setTab('basics');
        return;
      }
      addEvent({
        ...draft,
        id: 'e' + Date.now(),
        status: status ?? 'draft',
        cap: draft.tiers.reduce((a, t) => a + (+t.qty || 0), 0),
      });
      navigate('/events');
    } else {
      if (status) updateEvent(event.id, { status });
      toast('Event saved ✓');
    }
  };

  const sm = EVENT_STATUS[event.status];

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/events" style={{ fontSize: 13 }}>← Events</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{isCreate ? 'Create event' : event.title}</h1>
        {!isCreate && <Tag {...sm} />}
        <div style={{ flex: 1 }} />
        {!isCreate && event.status === 'pending' && (
          <>
            <button className="btn btn-pri btn-sm" onClick={() => approveEvent(event.id)}>Approve ✓</button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                rejectEvent(event.id);
                navigate('/events');
              }}
            >
              Reject
            </button>
          </>
        )}
        {!isCreate && (
          <Link to={`/events/${event.id}/guestlist`} className="btn btn-ghost btn-sm">
            📋 Guest list
          </Link>
        )}
        {!isCreate && event.status === 'live' && (
          <Link to={`/events/${event.id}/live`} className="btn btn-ghost btn-sm" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>
            ● Live monitor →
          </Link>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => toast('Opening guest preview…')}>Preview as guest</button>
        {isCreate ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => save('draft')}>Save draft</button>
            <button className="btn btn-pri btn-sm" disabled={!canSave} onClick={() => save('live')}>Publish live →</button>
          </>
        ) : (
          <button className="btn btn-pri btn-sm" onClick={() => save()}>Save</button>
        )}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'basics' && (
        <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field" style={{ gridColumn: '1 / 3' }}>
            <label>Event title</label>
            <input className="input" value={event.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Event title" />
          </div>
          <div className="field" style={{ gridColumn: '1 / 3' }}>
            <label>Description</label>
            <textarea
              className="input"
              style={{ minHeight: 64, resize: 'vertical' }}
              value={event.description ?? ''}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="What should guests expect?"
            />
          </div>
          <div className="field">
            <label>Category</label>
            <select
              className="input"
              value={event.category}
              onChange={(e) => patch({ category: e.target.value, subCategory: CATEGORY_SUBS[e.target.value]?.[0] ?? '' })}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Sub-category</label>
            <select
              className="input"
              value={event.subCategory ?? CATEGORY_SUBS[event.category]?.[0] ?? ''}
              onChange={(e) => patch({ subCategory: e.target.value })}
            >
              {(CATEGORY_SUBS[event.category] ?? []).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Venue</label>
            <select
              className="input"
              value={event.venue}
              onChange={(e) => {
                const v = venues.find((x) => x.name === e.target.value);
                patch({ venue: e.target.value, city: v?.city ?? event.city });
              }}
            >
              {venues.map((v) => (
                <option key={v.id} value={v.name}>{v.name}{!v.verified ? ' (docs pending)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input className="input" value={event.date} onChange={(e) => patch({ date: e.target.value })} placeholder="24 Jul" />
          </div>
          <div className="field">
            <label>Start time</label>
            <input className="input" value={event.time} onChange={(e) => patch({ time: e.target.value })} placeholder="8:00 PM" />
          </div>
          <div className="field">
            <label>Total duration (hours)</label>
            <input className="input" inputMode="decimal" value={event.durationHrs ?? ""} onChange={(e) => patch({ durationHrs: parseFloat(e.target.value) || undefined })} placeholder="e.g. 5" />
          </div>
          <div className="field" style={{ gridColumn: '1 / 3' }}>
            <label>Organizer</label>
            <select className="input" value={event.organizer} onChange={(e) => patch({ organizer: e.target.value })}>
              {organizers.map((o) => (
                <option key={o.id} value={o.name} disabled={o.status !== 'approved'}>
                  {o.name}{o.status !== 'approved' ? ` (${o.status})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="stack" style={{ gap: 8 }}>
          {event.tiers.map((t, i) => (
            <div key={i} className="card" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '10px 12px', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 2, minWidth: 120 }}>
                <label>Tier name</label>
                <input className="input" value={t.name} onChange={(e) => patchTier(i, { name: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 80 }}>
                <label>Price ₹</label>
                <input className="input" value={String(t.price)} inputMode="numeric" onChange={(e) => patchTier(i, { price: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 80 }}>
                <label>Qty</label>
                <input className="input" value={String(t.qty)} inputMode="numeric" onChange={(e) => patchTier(i, { qty: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })} />
              </div>
              <span className="tiny muted" style={{ paddingBottom: 10 }}>{t.sold >= t.qty && t.qty > 0 ? 'sold out' : `${fmt(t.sold)} sold`}</span>
              <button
                className="btn btn-danger btn-sm"
                disabled={event.tiers.length === 1 || t.sold > 0}
                title={t.sold > 0 ? 'Tier has sold tickets' : 'Remove tier'}
                onClick={() => patch({ tiers: event.tiers.filter((_, x) => x !== i) })}
              >
                ✕
              </button>
              <div className="field" style={{ flexBasis: '100%' }}>
                <label>Ticket description — what's included, shown under the tier on the guest page</label>
                <input
                  className="input"
                  value={t.description ?? ''}
                  onChange={(e) => patchTier(i, { description: e.target.value })}
                  placeholder="e.g. Entry + 2 drinks + lounge access · gates close 9:30 PM"
                />
              </div>
            </div>
          ))}
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: 'fit-content' }}
            onClick={() => patch({ tiers: [...event.tiers, { name: 'VIP', price: 1200, qty: 50, sold: 0, description: '' }] })}
          >
            + Add tier
          </button>
          <div className="tiny hint">supports per-tier sale window, per-person limit</div>
        </div>
      )}

      {tab === 'media' && (
        <div className="stack" style={{ gap: 10 }}>
          <ImagePicker
            value={event.posterDataUrl}
            onChange={(dataUrl) => patch({ hasBanner: true, posterDataUrl: dataUrl })}
            height={160}
            width={130}
            label="⬆ poster 3:4 · min 900px"
          />
          <div className="field">
            <label>Gallery photos (up to 6)</label>
            <GalleryPicker
              value={event.galleryDataUrls ?? []}
              onChange={(urls) => patch({ galleryDataUrls: urls })}
              label="+ add"
            />
          </div>
          <VideoPicker
            value={event.teaserDataUrl}
            onChange={(dataUrl) => patch({ teaserDataUrl: dataUrl })}
            label="⬆ teaser reel · 9:16"
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <ImagePicker
              value={event.socialPostDataUrl}
              onChange={(dataUrl) => patch({ socialPost: true, socialPostDataUrl: dataUrl })}
              height={70}
              label="⬆ social post banner 1:1 · ≤5 MB"
            >
              <span className="tiny" style={{ margin: 'auto', color: '#fff' }}>✓ social post banner 1:1</span>
            </ImagePicker>
            <ImagePicker
              value={event.socialStoryDataUrl}
              onChange={(dataUrl) => patch({ socialStory: true, socialStoryDataUrl: dataUrl })}
              height={70}
              label="⬆ social story banner 9:16 · ≤5 MB"
            >
              <span className="tiny" style={{ margin: 'auto', color: '#fff' }}>✓ social story banner 9:16</span>
            </ImagePicker>
          </div>
          <div className="tiny hint">poster shows on guest cards & event page · reels feed the “Things happening at events” slider</div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="field">
            <label>Event conditions & party rules (one per line — bullets on the guest page)</label>
            <textarea
              className="input"
              style={{ minHeight: 120, resize: 'vertical' }}
              value={event.rules ?? ''}
              onChange={(e) => patch({ rules: e.target.value })}
              placeholder={'Photo ID required\nNo re-entry\nDress code: smart casual'}
            />
          </div>
          <div className="tiny hint">shown under “Event conditions” and the rules accordions on the guest event page</div>
        </div>
      )}

      {tab === 'commission' && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="display" style={{ fontWeight: 700 }}>Commission &amp; fees — this event only</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 160 }}>Platform commission</span>
              <input
                className="input"
                style={{ width: 70, textAlign: 'center' }}
                value={String(commission)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  patch({ commission: v === '' ? 0 : parseFloat(v) });
                }}
              />
              <span className="muted">%</span>
              <span className="tiny hint">negotiated with organizer</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 160 }}>Booking fee (per ticket)</span>
              <span style={{ color: '#c7cbb9' }}>₹{settings.bookingFee} <span className="tiny hint">· platform default (Settings)</span></span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 160 }}>GST on platform fee</span>
              <span style={{ color: '#c7cbb9' }}>{settings.gstPct}%</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 160 }}>Fee absorbed by</span>
              <span className="chip on" style={{ fontSize: 10.5 }}>{settings.absorbedBy}</span>
            </div>
          </div>
          <div className="dashed-box">
            <b style={{ color: 'var(--text)' }}>Live preview — ₹{fmt(previewPrice)} ticket:</b> guest pays{' '}
            <b style={{ color: 'var(--text)' }}>₹{fmt(guestPays)}</b> · platform keeps{' '}
            <b className="green">₹{fmt(platformKeeps)}</b> · organizer nets{' '}
            <b style={{ color: 'var(--text)' }}>₹{fmt(organizerNets)}</b>
          </div>
          <div className="tiny hint">Commission is set per event — there is no global rate. Locks once the event goes live.</div>
        </div>
      )}

      {tab === 'seo' && (
        <SeoFields
          seo={event.seo ?? emptySeo()}
          onChange={(next) => patch({ seo: next })}
          slug={'/events/' + (event.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}
          fallbackTitle={`${event.title || 'Event'} tickets`}
        />
      )}

      {tab === 'lineup' && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="field">
            <label>Line-up &amp; partners — “Name (Role)”, comma-separated</label>
            <input
              className="input"
              value={event.lineup ?? ''}
              onChange={(e) => patch({ lineup: e.target.value })}
              placeholder="DJ Nova (Opening DJ), The Wilds (Headline artist), FizzCo (Sponsor)"
            />
          </div>
          {(event.lineup ?? '').trim() && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(event.lineup ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => (
                  <span key={s} className="chip">🎤 {s}</span>
                ))}
            </div>
          )}
          <div className="tiny hint">shown as chips with photos on the guest event page</div>
        </div>
      )}
    </div>
  );
}
