import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Mic2, Landmark, Megaphone, Headphones, X, CheckCircle2, Mail, MessageCircle, Calendar } from 'lucide-react';
import {
  liveLeads,
  liveStaff,
  liveMe,
  liveKyc,
  LiveApiError,
  LEAD_SOURCES,
  LEAD_STAGES,
  LEAD_ROLES,
  type Lead,
  type LeadRole,
  type LeadOrganizerHit,
  type LeadDirectoryHit,
  type LiveStaff,
  type LiveStaffMe,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Kpi, Drawer, LiveLocationPicker } from '../components/ui';

const TITLE = 'Leads';
const ROLE_LABEL: Record<LeadRole, string> = { organizer: 'Organizer', venue: 'Venue', promoter: 'Promoter', lineup: 'Line-up' };
const ROLE_ICON: Record<LeadRole, ComponentType<{ size?: number }>> = { organizer: Mic2, venue: Landmark, promoter: Megaphone, lineup: Headphones };
const RoleIcon = ({ role, size = 12 }: { role: LeadRole; size?: number }) => {
  const Icon = ROLE_ICON[role];
  return <Icon size={size} />;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
// Follow-ups now carry a real time, not just a date (see the separate
// date/time inputs below) — shows it whenever it's not the bare midnight
// default a date-only value would have produced before this.
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const isMidnight = d.getHours() === 0 && d.getMinutes() === 0;
  if (isMidnight) return date;
  return `${date}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}
// Splits a lead's stored followUpAt back into the separate date/time
// values the two form inputs need, in the browser's own local time — the
// ISO string from the API is UTC, so this can't just slice(0,16) the way
// the old date-only slice(0,10) could (that happened to work only because
// a bare date has no timezone to get wrong). See the load() usage below,
// which splits this on "T" into the two fields.
function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Date and time are separate inputs in the form (see the "Follow up on"
// field below) — combines them back into the one string the API expects.
// No date means no follow-up at all, same as before; a date with no time
// still works fine on its own (new Date("2026-08-30") is valid, just
// midnight local), so time is optional even once a date's picked.
function combineDateTime(date: string, time: string): string {
  if (!date) return '';
  return time ? `${date}T${time}` : date;
}
function isOverdue(lead: Lead) {
  return Boolean(lead.followUpAt) && new Date(lead.followUpAt as string).getTime() < Date.now() && !['Signed up', 'Declined'].includes(lead.stage);
}
/** Whichever of organizer/venue/promoter/lineup is actually linked — at
 * most one is ever set, matching `lead.role`. */
function linkedLabel(lead: Lead): string | null {
  if (lead.organizer) return `${lead.organizer.brandName} (@${lead.organizer.username})`;
  if (lead.venue) return lead.venue.name;
  if (lead.promoter) return `${lead.promoter.name} (@${lead.promoter.slug})`;
  if (lead.lineup) return `${lead.lineup.name} (@${lead.lineup.slug})`;
  return null;
}
// "Start Onboarding" only makes sense once the lead team has actually
// talked to someone — not on a fresh, untouched "New" card, and not once
// it's already resolved (Signed up / Declined).
const ONBOARDABLE_STAGES = ['Contacted', 'Interested', 'Negotiating'];

const emptyOnboardForm = {
  brandName: '', contactPerson: '', contact: '', country: '', state: '', city: '', pincode: '', eventTypes: '', about: '', instagram: '', facebook: '',
};

type DirHit = LeadOrganizerHit | LeadDirectoryHit | (LeadDirectoryHit & { slug: string });
function hitLabel(h: DirHit) {
  return 'brandName' in h ? h.brandName : h.name;
}
function hitSub(h: DirHit) {
  const handle = 'username' in h ? h.username : 'slug' in h ? h.slug : null;
  return [handle ? `@${handle}` : null, h.city].filter(Boolean).join(' · ');
}

const emptyForm = {
  name: '', role: 'organizer' as LeadRole, source: LEAD_SOURCES[0] as string, contact: '', alternateContact: '', email: '', contactPerson: '',
  country: '', state: '', city: '', eventType: '', assignedToId: '', followUpDate: '', followUpTime: '',
};

/** Sales pipeline across every outreach channel — organizer, venue,
 * promoter and line-up leads all share this one Kanban (see liveLeads/
 * LeadsService), distinguished by `role`. A Sales-scoped staffer only ever
 * sees/works the role(s) they're assigned (enforced server-side — see
 * StaffRoles.tsx's lead-scope picker); this page just renders whatever
 * `list()` returns and narrows its own "add lead" role options to match. */
export default function Leads() {
  const session = useLiveSession();
  const { token } = session;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<LiveStaff[]>([]);
  const [me, setMe] = useState<LiveStaffMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [roleFilter, setRoleFilter] = useState<'all' | LeadRole>('all');
  const [drawer, setDrawer] = useState<'create' | string | null>(null); // 'create' or a lead id
  const [form, setForm] = useState(emptyForm);
  const [activityText, setActivityText] = useState('');
  const [dirQuery, setDirQuery] = useState('');
  const [dirHits, setDirHits] = useState<DirHit[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState<'email' | 'whatsapp' | null>(null);
  const [sendMsg, setSendMsg] = useState<ReactNode>('');
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState(emptyOnboardForm);
  const [onboardBusy, setOnboardBusy] = useState(false);
  const [onboardSent, setOnboardSent] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    // liveStaff.list() is Owner-only server-side (staff management isn't
    // part of the delegatable permission matrix at all) — a non-Owner with
    // real Leads access hitting that 403 used to reject this whole
    // Promise.all and silently blank the entire page, including their own
    // leads, which *did* load fine. It's only used here for the "assigned
    // to" name label (staffName() already falls back to '' when a staff
    // member isn't found), so a caught failure just means that label goes
    // blank instead of the whole board disappearing.
    Promise.all([liveLeads.list(), liveStaff.list().catch(() => []), liveMe.get()])
      .then(([l, s, m]) => {
        setLeads(l);
        setStaff(s);
        setMe(m);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const allowedRoles: LeadRole[] = me && me.leadRoleScope.length ? (me.leadRoleScope.filter((r) => LEAD_ROLES.includes(r as LeadRole)) as LeadRole[]) : LEAD_ROLES;
  const selected = typeof drawer === 'string' ? leads.find((l) => l.id === drawer) : null;

  const openCreate = () => {
    setForm({ ...emptyForm, role: allowedRoles[0] ?? 'organizer' });
    setDrawer('create');
  };
  const openLead = (lead: Lead) => {
    setForm({
      name: lead.name,
      role: lead.role,
      source: lead.source,
      contact: lead.contact ?? '',
      alternateContact: lead.alternateContact ?? '',
      email: lead.email ?? '',
      contactPerson: lead.contactPerson ?? '',
      country: lead.country ?? '',
      state: lead.state ?? '',
      city: lead.city ?? '',
      eventType: lead.eventType ?? '',
      assignedToId: lead.assignedToId ?? '',
      ...(lead.followUpAt
        ? (([d, t]) => ({ followUpDate: d, followUpTime: t }))(toDatetimeLocal(lead.followUpAt).split('T'))
        : { followUpDate: '', followUpTime: '' }),
    });
    setActivityText('');
    setDirQuery('');
    setDirHits([]);
    setSendMsg('');
    setOnboardOpen(false);
    setOnboardSent(false);
    setOnboardForm({
      ...emptyOnboardForm,
      brandName: lead.name,
      contactPerson: lead.contactPerson ?? '',
      country: lead.country ?? '',
      state: lead.state ?? '',
      city: lead.city ?? '',
      eventTypes: lead.eventType ?? '',
    });
    setDrawer(lead.id);
  };
  const close = () => setDrawer(null);

  const saveCreate = async () => {
    if (!form.name.trim()) return setErr('Name is required');
    setErr('');
    try {
      await liveLeads.create({
        name: form.name,
        role: form.role,
        source: form.source,
        contact: form.contact || undefined,
        alternateContact: form.alternateContact || undefined,
        email: form.email || undefined,
        contactPerson: form.contactPerson || undefined,
        country: form.country || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        eventType: form.eventType || undefined,
        assignedToId: form.assignedToId || undefined,
        followUpAt: combineDateTime(form.followUpDate, form.followUpTime) || undefined,
      });
      close();
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to add lead');
    }
  };

  const saveEdit = async () => {
    if (!selected) return;
    setErr('');
    try {
      await liveLeads.update(selected.id, {
        name: form.name,
        source: form.source,
        contact: form.contact,
        alternateContact: form.alternateContact,
        email: form.email,
        contactPerson: form.contactPerson,
        country: form.country,
        state: form.state,
        city: form.city,
        eventType: form.eventType,
        assignedToId: form.assignedToId || null,
        followUpAt: combineDateTime(form.followUpDate, form.followUpTime) || null,
      });
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    }
  };

  const setStage = async (id: string, stage: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    try {
      await liveLeads.update(id, { stage });
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to move lead');
      load();
    }
  };

  const removeLead = async () => {
    if (!selected) return;
    if (!confirm(`Remove "${selected.name}" from leads? This can't be undone.`)) return;
    try {
      await liveLeads.remove(selected.id);
      close();
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to remove');
    }
  };

  const logActivity = async () => {
    if (!selected || !activityText.trim()) return;
    try {
      await liveLeads.addActivity(selected.id, activityText.trim());
      setActivityText('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to log activity');
    }
  };

  const runDirSearch = (q: string) => {
    setDirQuery(q);
    if (!q.trim() || !selected) return setDirHits([]);
    const fn =
      selected.role === 'organizer' ? liveLeads.searchOrganizers
      : selected.role === 'venue' ? liveLeads.searchVenues
      : selected.role === 'promoter' ? liveLeads.searchPromoters
      : liveLeads.searchLineups;
    fn(q).then(setDirHits).catch(() => setDirHits([]));
  };

  const sendOnboarding = async (channel: 'email' | 'whatsapp') => {
    if (!selected) return;
    setSendBusy(channel);
    setSendMsg('');
    setErr('');
    try {
      await liveLeads.sendOnboarding(selected.id, { [channel]: true });
      setSendMsg(channel === 'email' ? <>Onboarding email sent <CheckCircle2 size={13} /></> : <>Sent via WhatsApp <CheckCircle2 size={13} /></>);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send');
    } finally {
      setSendBusy(null);
    }
  };

  const linkHit = async (hitId: string) => {
    if (!selected) return;
    try {
      const fn =
        selected.role === 'organizer' ? liveLeads.linkOrganizer
        : selected.role === 'venue' ? liveLeads.linkVenue
        : selected.role === 'promoter' ? liveLeads.linkPromoter
        : liveLeads.linkLineup;
      await fn(selected.id, hitId);
      setDirQuery('');
      setDirHits([]);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to link');
    }
  };

  const startOnboarding = async () => {
    if (!selected) return;
    if (!onboardForm.brandName.trim() || !onboardForm.contactPerson.trim() || !onboardForm.city.trim() || !onboardForm.state.trim() || !onboardForm.country.trim() || !onboardForm.eventTypes.trim()) {
      setErr('Brand name, contact person, city, state, country and event types are all required');
      return;
    }
    setOnboardBusy(true);
    setErr('');
    const submit = (confirmExistingUser?: boolean) =>
      liveKyc.startOrganizerOnboarding(selected.id, {
        brandName: onboardForm.brandName.trim(),
        contactPerson: onboardForm.contactPerson.trim(),
        city: onboardForm.city.trim(),
        state: onboardForm.state.trim(),
        country: onboardForm.country.trim(),
        pincode: onboardForm.pincode.trim() || undefined,
        eventTypes: onboardForm.eventTypes.trim(),
        about: onboardForm.about.trim() || undefined,
        socialLinks: (onboardForm.instagram.trim() || onboardForm.facebook.trim())
          ? { instagram: onboardForm.instagram.trim() || undefined, facebook: onboardForm.facebook.trim() || undefined }
          : undefined,
        confirmExistingUser,
      });
    try {
      try {
        await submit();
      } catch (e) {
        // This lead's phone already belongs to a real, unrelated Prebooze
        // account — don't silently reuse a stranger's identity. Confirm
        // with staff first, same "are you sure" pattern as removeLead below.
        if (e instanceof LiveApiError && e.message.startsWith('EXISTING_ACCOUNT:')) {
          const proceed = confirm(e.message.replace('EXISTING_ACCOUNT: ', '') + '\n\nContinue anyway?');
          if (!proceed) { setOnboardBusy(false); return; }
          await submit(true);
        } else {
          throw e;
        }
      }
      setOnboardSent(true);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send for verification');
    } finally {
      setOnboardBusy(false);
    }
  };

  const visibleLeads = roleFilter === 'all' ? leads : leads.filter((l) => l.role === roleFilter);

  const total = visibleLeads.length;
  const signedUp = visibleLeads.filter((l) => l.stage === 'Signed up').length;
  const declined = visibleLeads.filter((l) => l.stage === 'Declined').length;
  const active = total - signedUp - declined;
  const responded = visibleLeads.filter((l) => l.stage !== 'New').length;
  const overdueCount = visibleLeads.filter(isOverdue).length;

  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.name ?? '';

  return (
    <div className="stack fade" style={{ maxWidth: 1280 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Leads</h1>
        <button className="btn btn-pri" onClick={openCreate}>+ Add lead</button>
      </div>

      {allowedRoles.length > 1 && (
        <div className="tabs">
          <button className={roleFilter === 'all' ? 'on' : ''} onClick={() => setRoleFilter('all')}>
            All ({leads.length})
          </button>
          {allowedRoles.map((r) => (
            <button key={r} className={roleFilter === r ? 'on' : ''} onClick={() => setRoleFilter(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <RoleIcon role={r} /> {ROLE_LABEL[r]} ({leads.filter((l) => l.role === r).length})
            </button>
          ))}
        </div>
      )}

      <div className="kpi-grid">
        <Kpi label="Total leads" value={total} />
        <Kpi label="In progress" value={active} />
        <Kpi label="Signed up" value={<span className="green">{signedUp}</span>} />
        <Kpi label="Response rate" value={total ? `${Math.round((responded / total) * 100)}%` : '0%'} />
        {overdueCount > 0 && <Kpi label="Follow-ups overdue" value={<span className="red">{overdueCount}</span>} alert />}
      </div>

      <div className="kanban">
        {LEAD_STAGES.map((stage) => {
          const col = visibleLeads.filter((l) => l.stage === stage);
          return (
            <div
              key={stage}
              className="kanban-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) setStage(id, stage);
                setDraggingId(null);
              }}
            >
              <div className="kanban-col-hd">
                <span>{stage}</span>
                <span className="tiny muted">{col.length}</span>
              </div>
              <div className="kanban-col-body">
                {col.length === 0 && <div className="tiny muted" style={{ padding: '10px 4px' }}>—</div>}
                {col.map((lead) => (
                  <div
                    key={lead.id}
                    className={`lead-card${draggingId === lead.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', lead.id);
                      setDraggingId(lead.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => openLead(lead)}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{lead.name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '5px 0' }}>
                      {roleFilter === 'all' && <span className="tag tag-dim" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><RoleIcon role={lead.role} size={11} /> {ROLE_LABEL[lead.role]}</span>}
                      <span className="tag">{lead.source}</span>
                      {lead.city && <span className="tag tag-dim">{lead.city}</span>}
                    </div>
                    {lead.activities[0] && (
                      <div className="tiny muted" style={{ marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.activities[0].text}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="tiny muted">{lead.assignedToId ? staffName(lead.assignedToId) : '—'}</span>
                      {lead.followUpAt && (
                        <span className={`tiny ${isOverdue(lead) ? 'red' : 'muted'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Calendar size={11} /> {fmtDateTime(lead.followUpAt)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {drawer && (
        <Drawer onClose={close}>
          <div className="page-hd">
            <h2 style={{ font: '700 16px "Space Grotesk", sans-serif' }}>{drawer === 'create' ? 'Add lead' : 'Lead'}</h2>
            <button className="btn btn-ghost btn-sm" onClick={close}><X size={14} /></button>
          </div>

          {drawer === 'create' ? (
            <div className="field">
              <label>Lead type</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as LeadRole })}>
                {allowedRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
          ) : (
            selected && <div className="tag tag-dim" style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 4 }}><RoleIcon role={selected.role} size={11} /> {ROLE_LABEL[selected.role]} lead</div>
          )}

          <div className="field">
            <label>Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder="Brand or account name" />
          </div>
          <div className="field">
            <label>Contact person</label>
            <input className="input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="e.g. Priya (owner)" />
          </div>
          <div className="field">
            <label>Source</label>
            <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Phone / handle</label>
            <input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="For WhatsApp / calls" />
          </div>
          <div className="field">
            <label>Alternate number (optional)</label>
            <input className="input" value={form.alternateContact} onChange={(e) => setForm({ ...form, alternateContact: e.target.value })} placeholder="A second number, if they gave one" />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Location</label>
            <LiveLocationPicker
              value={{ country: form.country, state: form.state, city: form.city }}
              onChange={(v) => setForm({ ...form, ...v })}
            />
          </div>
          <div className="field">
            <label>What they run</label>
            <input className="input" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} placeholder="e.g. rooftop nights, college fests" />
          </div>
          <div className="field">
            <label>Assigned to</label>
            <select className="input" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Follow up on</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="date" style={{ flex: 1 }} value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
              <input className="input" type="time" style={{ flex: 1 }} value={form.followUpTime} onChange={(e) => setForm({ ...form, followUpTime: e.target.value })} disabled={!form.followUpDate} />
            </div>
          </div>

          {drawer === 'create' ? (
            <button className="btn btn-pri" onClick={saveCreate}>Add lead</button>
          ) : (
            selected && (
              <>
                <div className="field">
                  <label>Stage</label>
                  <select className="input" value={selected.stage} onChange={(e) => setStage(selected.id, e.target.value)}>
                    {LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button className="btn btn-pri" onClick={saveEdit}>Save changes</button>

                <hr />

                <div className="field">
                  <label>Send onboarding link</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={!selected.email || sendBusy !== null}
                      onClick={() => sendOnboarding('email')}
                      title={!selected.email ? 'Add an email above first' : undefined}
                    >
                      {sendBusy === 'email' ? 'Sending…' : <><Mail size={13} /> Email</>}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={!selected.contact || sendBusy !== null}
                      onClick={() => sendOnboarding('whatsapp')}
                      title={!selected.contact ? 'Add a phone number above first' : undefined}
                    >
                      {sendBusy === 'whatsapp' ? 'Sending…' : <><MessageCircle size={13} /> WhatsApp</>}
                    </button>
                  </div>
                  {sendMsg && <div className="tiny green">{sendMsg}</div>}
                </div>

                <hr />

                {selected.role === 'organizer' && !linkedLabel(selected) && ONBOARDABLE_STAGES.includes(selected.stage) && (
                  <>
                    <div className="field">
                      {onboardSent ? (
                        <div className="dashed-box" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} style={{ flex: 'none' }} /> Sent for verification — the verification team will take it from here.</div>
                      ) : (
                        <>
                          <label>Start onboarding</label>
                          <div className="tiny muted" style={{ marginBottom: onboardOpen ? 8 : 0 }}>
                            Fill in what you have from the call. GSTIN, PAN, bank details and documents are collected separately by the verification team.
                          </div>
                          {!onboardOpen ? (
                            <button className="btn btn-pri btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOnboardOpen(true)}>
                              + Start onboarding
                            </button>
                          ) : (
                            <div className="stack" style={{ gap: 8, marginTop: 4 }}>
                              <div className="field">
                                <label>Brand name *</label>
                                <input className="input" value={onboardForm.brandName} onChange={(e) => setOnboardForm({ ...onboardForm, brandName: e.target.value })} />
                              </div>
                              <div className="field">
                                <label>Contact person *</label>
                                <input className="input" value={onboardForm.contactPerson} onChange={(e) => setOnboardForm({ ...onboardForm, contactPerson: e.target.value })} />
                              </div>
                              <div className="field">
                                <label>Location *</label>
                                <LiveLocationPicker
                                  value={{ country: onboardForm.country, state: onboardForm.state, city: onboardForm.city }}
                                  onChange={(v) => setOnboardForm({ ...onboardForm, ...v })}
                                />
                              </div>
                              <div className="field">
                                <label>Pincode</label>
                                <input className="input" value={onboardForm.pincode} onChange={(e) => setOnboardForm({ ...onboardForm, pincode: e.target.value })} />
                              </div>
                              <div className="field">
                                <label>Event types *</label>
                                <input
                                  className="input"
                                  value={onboardForm.eventTypes}
                                  onChange={(e) => setOnboardForm({ ...onboardForm, eventTypes: e.target.value })}
                                  placeholder="e.g. Concerts, Club nights"
                                />
                              </div>
                              <div className="field">
                                <label>About</label>
                                <textarea className="input" rows={2} value={onboardForm.about} onChange={(e) => setOnboardForm({ ...onboardForm, about: e.target.value })} />
                              </div>
                              <div className="field">
                                <label>Instagram</label>
                                <input className="input" value={onboardForm.instagram} onChange={(e) => setOnboardForm({ ...onboardForm, instagram: e.target.value })} />
                              </div>
                              <div className="field">
                                <label>Facebook</label>
                                <input className="input" value={onboardForm.facebook} onChange={(e) => setOnboardForm({ ...onboardForm, facebook: e.target.value })} />
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-pri btn-sm" disabled={onboardBusy} onClick={startOnboarding}>
                                  {onboardBusy ? 'Sending…' : 'Send for verification'}
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setOnboardOpen(false)}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <hr />
                  </>
                )}

                {linkedLabel(selected) ? (
                  <div className="dashed-box" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} style={{ flex: 'none' }} /> Linked to {ROLE_LABEL[selected.role].toLowerCase()} <b>{linkedLabel(selected)}</b>
                  </div>
                ) : (
                  <div className="field">
                    <label>Link to {ROLE_LABEL[selected.role].toLowerCase()} (once they've signed up)</label>
                    <input className="input" placeholder="Search by name or handle…" value={dirQuery} onChange={(e) => runDirSearch(e.target.value)} />
                    {dirHits.length > 0 && (
                      <div className="card" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dirHits.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => linkHit(h.id)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left',
                              background: 'none', border: 'none', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--text)', fontSize: 12.5,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,195,74,.1)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          >
                            <span>{hitLabel(h)}</span>
                            <span className="tiny muted">{hitSub(h)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <hr />

                <div className="field">
                  <label>Activity</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="e.g. Called, asked about commission — will decide by Friday"
                    value={activityText}
                    onChange={(e) => setActivityText(e.target.value)}
                  />
                  <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={logActivity}>Log activity</button>
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {selected.activities.length === 0 && <div className="tiny muted">No activity logged yet.</div>}
                  {selected.activities.map((a) => (
                    <div key={a.id} className="tiny" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                      <div>{a.text}</div>
                      <div className="muted">{timeAgo(a.createdAt)}</div>
                    </div>
                  ))}
                </div>

                <hr />
                <button className="btn btn-danger btn-sm" onClick={removeLead}>Remove lead</button>
              </>
            )
          )}
        </Drawer>
      )}
    </div>
  );
}
