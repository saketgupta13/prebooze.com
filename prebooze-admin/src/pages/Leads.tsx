import { useEffect, useState } from 'react';
import {
  liveLeads,
  liveStaff,
  LiveApiError,
  LEAD_SOURCES,
  LEAD_STAGES,
  type Lead,
  type LeadOrganizerHit,
  type LiveStaff,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Kpi, Drawer } from '../components/ui';

const TITLE = 'Leads';

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

const emptyForm = { name: '', source: LEAD_SOURCES[0] as string, contact: '', city: '', eventType: '', assignedToId: '', followUpAt: '' };

/** Organizer sales pipeline across every outreach channel (see
 * liveLeads/LeadsService) — a Kanban board so the day-to-day view is "what
 * needs to move next," with a side drawer for the full record: editable
 * fields, a dated activity timeline (not one flat notes box), and a manual
 * link to the real Organizer once they actually sign up. */
export default function Leads() {
  const session = useLiveSession();
  const { token } = session;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<LiveStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [drawer, setDrawer] = useState<'create' | string | null>(null); // 'create' or a lead id
  const [form, setForm] = useState(emptyForm);
  const [activityText, setActivityText] = useState('');
  const [orgQuery, setOrgQuery] = useState('');
  const [orgHits, setOrgHits] = useState<LeadOrganizerHit[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveLeads.list(), liveStaff.list()])
      .then(([l, s]) => {
        setLeads(l);
        setStaff(s);
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

  const selected = typeof drawer === 'string' ? leads.find((l) => l.id === drawer) : null;

  const openCreate = () => {
    setForm(emptyForm);
    setDrawer('create');
  };
  const openLead = (lead: Lead) => {
    setForm({
      name: lead.name,
      source: lead.source,
      contact: lead.contact ?? '',
      city: lead.city ?? '',
      eventType: lead.eventType ?? '',
      assignedToId: lead.assignedToId ?? '',
      followUpAt: lead.followUpAt ? lead.followUpAt.slice(0, 10) : '',
    });
    setActivityText('');
    setOrgQuery('');
    setOrgHits([]);
    setDrawer(lead.id);
  };
  const close = () => setDrawer(null);

  const saveCreate = async () => {
    if (!form.name.trim()) return setErr('Name is required');
    setErr('');
    try {
      await liveLeads.create({
        name: form.name,
        source: form.source,
        contact: form.contact || undefined,
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

  const runOrgSearch = (q: string) => {
    setOrgQuery(q);
    if (!q.trim()) return setOrgHits([]);
    liveLeads.searchOrganizers(q).then(setOrgHits).catch(() => setOrgHits([]));
  };

  const linkOrganizer = async (organizerId: string) => {
    if (!selected) return;
    try {
      await liveLeads.linkOrganizer(selected.id, organizerId);
      setOrgQuery('');
      setOrgHits([]);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to link');
    }
  };

  const total = leads.length;
  const signedUp = leads.filter((l) => l.stage === 'Signed up').length;
  const declined = leads.filter((l) => l.stage === 'Declined').length;
  const active = total - signedUp - declined;
  const responded = leads.filter((l) => l.stage !== 'New').length;
  const overdueCount = leads.filter(isOverdue).length;

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

      <div className="kpi-grid">
        <Kpi label="Total leads" value={total} />
        <Kpi label="In progress" value={active} />
        <Kpi label="Signed up" value={<span className="green">{signedUp}</span>} />
        <Kpi label="Response rate" value={total ? `${Math.round((responded / total) * 100)}%` : '0%'} />
        {overdueCount > 0 && <Kpi label="Follow-ups overdue" value={<span className="red">{overdueCount}</span>} alert />}
      </div>

      <div className="kanban">
        {LEAD_STAGES.map((stage) => {
          const col = leads.filter((l) => l.stage === stage);
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

          <div className="field">
            <label>Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder="Brand or account name" />
          </div>
          <div className="field">
            <label>Source</label>
            <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Contact (phone / handle / email)</label>
            <input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
          <div className="field">
            <label>City</label>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
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

                {selected.organizer ? (
                  <div className="dashed-box">
                    ✓ Linked to organizer <b>{selected.organizer.brandName}</b> (@{selected.organizer.username})
                  </div>
                ) : (
                  <div className="field">
                    <label>Link to organizer (once they've signed up)</label>
                    <input className="input" placeholder="Search by brand or username…" value={orgQuery} onChange={(e) => runOrgSearch(e.target.value)} />
                    {orgHits.length > 0 && (
                      <div className="card" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {orgHits.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => linkOrganizer(o.id)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left',
                              background: 'none', border: 'none', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--text)', fontSize: 12.5,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,195,74,.1)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          >
                            <span>{o.brandName}</span>
                            <span className="tiny muted">@{o.username} · {o.city}</span>
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
