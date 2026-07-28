import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fmt } from '../store/data';
import { Kpi, Tag } from '../components/ui';
import { liveOrganizers, liveEvents, LiveApiError, type LiveOrganizer, type LiveEvent, type LiveOrgStaffMember } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Organizer detail';
const STATUS_TAG: Record<string, { label: string; cls: string }> = {
  approved: { label: '● Live', cls: 'tag-green' },
  pending: { label: 'Pending', cls: 'tag-red' },
  draft: { label: 'Draft', cls: '' },
  rejected: { label: 'Rejected', cls: 'tag-dim' },
};

const eventRevenue = (e: LiveEvent) => e.tiers.reduce((a, t) => a + t.sold * t.price, 0);
const eventSold = (e: LiveEvent) => e.tiers.reduce((a, t) => a + t.sold, 0);
const eventCap = (e: LiveEvent) => e.tiers.reduce((a, t) => a + t.quantity, 0);

export default function OrganizerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [organizers, setOrganizers] = useState<LiveOrganizer[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [team, setTeam] = useState<LiveOrgStaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveOrganizers.list(), liveEvents.list()])
      .then(([orgs, evs]) => { setOrganizers(orgs); setEvents(evs); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);
  useEffect(() => {
    if (!token || !id) return;
    liveOrganizers.team(id).then(setTeam).catch(() => setTeam([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const removeTeamMember = (staffId: string, name: string) => {
    if (!id) return;
    if (!window.confirm(`Remove ${name} from this organizer's team?`)) return;
    liveOrganizers
      .removeTeamMember(id, staffId)
      .then(() => setTeam((prev) => prev.filter((m) => m.id !== staffId)))
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to remove team member'));
  };

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const org = organizers.find((o) => o.id === id);
  const orgEvents = useMemo(() => events.filter((e) => e.organizerId === id), [events, id]);

  if (!loading && !org) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Organizer not found</h1>
        <Link to="/organizers" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Organizers</Link>
      </div>
    );
  }
  if (!org) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const lifetime = orgEvents.reduce((a, e) => a + eventRevenue(e), 0);
  const commissionPaid = orgEvents.reduce((a, e) => a + (eventRevenue(e) * (e.commission ?? 0)) / 100, 0);

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/organizers" style={{ fontSize: 13 }}>← Organizers</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{org.brandName}</h1>
        {org.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Unverified" cls="" />}
        <div style={{ flex: 1 }} />
        <Link to={`/organizers/${org.id}/edit`} className="btn btn-pri btn-sm">✎ Edit organizer</Link>
      </div>
      <div className="small muted">
        {org.contact || '—'} · {org.city} · organizer since {org.since} ·{' '}
        {orgEvents[0]?.commission != null ? `${orgEvents[0].commission}% commission deal` : 'commission set per event'}
      </div>

      <div className="kpi-grid">
        <Kpi label="Lifetime revenue" value={`₹${fmt(lifetime)}`} />
        <Kpi label="Commission paid" value={`₹${fmt(commissionPaid)}`} />
        <Kpi label="Net payouts" value={`₹${fmt(lifetime - commissionPaid)}`} />
        <Kpi label="Events run" value={org.eventsHosted || orgEvents.length} />
      </div>

      <div className="tblwrap">
        <div className="display" style={{ fontWeight: 700, padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          Income by event
        </div>
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 2 }}>Event</span>
          <span style={{ flex: 1 }}>Sold</span>
          <span style={{ flex: 1 }}>Gross</span>
          <span style={{ flex: 1 }}>Commission</span>
          <span style={{ flex: 1 }}>Net</span>
          <span style={{ flex: 0.8 }}>Status</span>
        </div>
        {orgEvents.map((ev) => {
          const c = ev.commission ?? 0;
          const rev = eventRevenue(ev);
          const commAmt = (rev * c) / 100;
          return (
            <div key={ev.id} className="trow clickable" style={{ minWidth: 560 }} onClick={() => navigate(`/events/${ev.id}`)}>
              <span style={{ flex: 2, fontWeight: 700 }}>{ev.title}</span>
              <span style={{ flex: 1 }}>{fmt(eventSold(ev))}/{fmt(eventCap(ev))}</span>
              <span style={{ flex: 1 }}>₹{fmt(rev)}</span>
              <span style={{ flex: 1 }}>₹{fmt(commAmt)} ({c}%)</span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(rev - commAmt)}</span>
              <span style={{ flex: 0.8 }}><Tag {...(STATUS_TAG[ev.status] ?? STATUS_TAG.draft)} /></span>
            </div>
          );
        })}
        {orgEvents.length === 0 && !loading && <div className="trow muted">No events yet for this organizer.</div>}
      </div>
      <div className="tiny hint">click an event row to open its editor</div>

      <div className="tblwrap">
        <div className="display" style={{ fontWeight: 700, padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          Team members
        </div>
        <div className="thead" style={{ minWidth: 480 }}>
          <span style={{ flex: 2 }}>Name</span>
          <span style={{ flex: 1.5 }}>Phone</span>
          <span style={{ flex: 1 }}>Role</span>
          <span style={{ flex: 0.6 }} />
        </div>
        {team.map((m) => (
          <div key={m.id} className="trow" style={{ minWidth: 480 }}>
            <span style={{ flex: 2, fontWeight: 700 }}>{m.name}</span>
            <span style={{ flex: 1.5 }}>{m.phone || '—'}</span>
            <span style={{ flex: 1 }}>{m.roleName}</span>
            <span style={{ flex: 0.6, textAlign: 'right' }}>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => removeTeamMember(m.id, m.name)}>
                ✕ Remove
              </button>
            </span>
          </div>
        ))}
        {team.length === 0 && <div className="trow muted">No team members invited yet.</div>}
      </div>
    </div>
  );
}
