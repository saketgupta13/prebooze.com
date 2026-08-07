import { useEffect, useState } from 'react';
import {
  liveLeads,
  liveStaff,
  liveMe,
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
const ROLE_EMOJI: Record<LeadRole, string> = { organizer: '🎤', venue: '🏛', promoter: '📣', lineup: '🎧' };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
type DirHit = LeadOrganizerHit | LeadDirectoryHit | (LeadDirectoryHit & { slug: string });
function hitLabel(h: DirHit) {
  return 'brandName' in h ? h.brandName : h.name;
}
function hitSub(h: DirHit) {
  const handle = 'username' in h ? h.username : 'slug' in h ? h.slug : null;
  return [handle ? `@${handle}` : null, h.city].filter(Boolean).join(' · ');
}

const emptyForm = {
  name: '', role: 'organizer' as LeadRole, source: LEAD_SOURCES[0] as string, contact: '', email: '', contactPerson: '',
  country: '', state: '', city: '', eventType: '', assignedToId: '', followUpAt: '',
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
  const [sendMsg, setSendMsg] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveLeads.list(), liveStaff.list(), liveMe.get()])
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
      email: lead.email ?? '',
      contactPerson: lead.contactPerson ?? '',
      country: lead.country ?? '',
      state: lead.state ?? '',
      city: lead.city ?? '',
      eventType: lead.eventType ?? '',
      assignedToId: lead.assignedToId ?? '',
      followUpAt: lead.followUpAt ? lead.followUpAt.slice(0, 10) : '',
    });
    setActivityText('');
    setDirQuery('');
    setDirHits([]);
    setSendMsg('');
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
        email: form.email || undefined,
        contactPerson: form.contactPerson || undefined,
        country: form.country || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        eventType: form.eventType || undefined,
        assignedToId: form.assignedToId || undefined,
        followUpAt: form.followUpAt || undefined,
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
        email: form.email,
        contactPerson: form.contactPerson,
        country: form.country,
        state: form.state,
        city: form.city,
        eventType: form.eventType,
        assignedToId: form.assignedToId || null,
        followUpAt: form.followUpAt || null,
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
      setSendMsg(channel === 'email' ? 'Onboarding email sent ✓' : 'Sent via WhatsApp ✓');
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
            <button key={r} className={roleFilter === r ? 'on' : ''} onClick={() => setRoleFilter(r)}>
              {ROLE_EMOJI[r]} {ROLE_LABEL[r]} ({leads.filter((l) => l.role === r).length})
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
                      {roleFilter === 'all' && <span className="tag tag-dim">{ROLE_EMOJI[lead.role]} {ROLE_LABEL[lead.role]}</span>}
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
                        <span className={`tiny ${isOverdue(lead) ? 'red' : 'muted'}`}>📅 {fmtDate(lead.followUpAt)}</span>
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
            <button className="btn btn-ghost btn-sm" onClick={close}>✕</button>
          </div>

          {drawer === 'create' ? (
            <div className="field">
              <label>Lead type</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as LeadRole })}>
                {allowedRoles.map((r) => <option key={r} value={r}>{ROLE_EMOJI[r]} {ROLE_LABEL[r]}</option>)}
              </select>
            </div>
          ) : (
            selected && <div className="tag tag-dim" style={{ width: 'fit-content' }}>{ROLE_EMOJI[selected.role]} {ROLE_LABEL[selected.role]} lead</div>
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
            <input className="input" type="date" value={form.followUpAt} onChange={(e) => setForm({ ...form, followUpAt: e.target.value })} />
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
                      {sendBusy === 'email' ? 'Sending…' : '✉️ Email'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={!selected.contact || sendBusy !== null}
                      onClick={() => sendOnboarding('whatsapp')}
                      title={!selected.contact ? 'Add a phone number above first' : undefined}
                    >
                      {sendBusy === 'whatsapp' ? 'Sending…' : '💬 WhatsApp'}
                    </button>
                  </div>
                  {sendMsg && <div className="tiny green">{sendMsg}</div>}
                </div>

                <hr />

                {linkedLabel(selected) ? (
                  <div className="dashed-box">
                    ✓ Linked to {ROLE_LABEL[selected.role].toLowerCase()} <b>{linkedLabel(selected)}</b>
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
