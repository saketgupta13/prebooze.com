import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CityFilterDropdown, Tag } from '../components/ui';
import { liveOrganizers, LiveApiError, type LiveOrganizer } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import PlansAndSubscribers from '../components/PlansAndSubscribers';

const TITLE = 'Organizers';

/** Real organizer directory — Organizer catalog rows (already-approved;
 * pending applications live entirely in Verifications, not here — see
 * KycService.approve, which is what actually creates these rows). Verified
 * toggles the real ✓ badge shown across the guest site. */
export default function Organizers() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [organizers, setOrganizers] = useState<LiveOrganizer[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [cityF, setCityF] = useState('All');

  const load = () => {
    setLoading(true);
    setErr('');
    liveOrganizers.list().then(setOrganizers).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const cities = useMemo(() => [...new Set(organizers.map((o) => o.city).filter(Boolean))].sort(), [organizers]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const toggleVerified = async (o: LiveOrganizer, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await liveOrganizers.setVerified(o.id, !o.verified); load(); } catch (err2) { setErr(err2 instanceof LiveApiError ? err2.message : 'Failed to update'); }
  };

  const list = cityF === 'All' ? organizers : organizers.filter((o) => o.city === cityF);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Organizers</h1>
        <Link to="/organizers/new" className="btn btn-pri">+ Add organizer</Link>
      </div>

      <CityFilterDropdown value={cityF} onChange={setCityF} cities={cities} />

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 640 }}>
          <span style={{ flex: 1.6 }}>Organizer</span>
          <span style={{ flex: 1.6 }}>Contact</span>
          <span style={{ flex: 1 }}>City</span>
          <span style={{ flex: 0.8 }}>Events</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1 }} />
        </div>
        {list.map((o) => (
          <div
            key={o.id}
            className="trow clickable"
            style={{ minWidth: 640 }}
            onClick={() => navigate(`/organizers/${o.id}`)}
          >
            <span style={{ flex: 1.6, fontWeight: 700 }}>{o.brandName}</span>
            <span style={{ flex: 1.6 }} className="muted">{o.contact || '—'}</span>
            <span style={{ flex: 1 }} className="muted">{o.city}</span>
            <span style={{ flex: 0.8 }}>{o.eventsHosted}</span>
            <span style={{ flex: 1 }}>
              {o.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Unverified" cls="" />}
            </span>
            <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={(e) => toggleVerified(o, e)}>
                {o.verified ? 'Unverify' : 'Verify'}
              </button>
            </span>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="trow muted">No organizers match.</div>}
      </div>
      <div className="tiny hint">
        pending organizer applications are reviewed under Verifications · click a row to open its detail page
      </div>

      <PlansAndSubscribers role="organizer" roleLabel="Organizer" />
    </div>
  );
}
