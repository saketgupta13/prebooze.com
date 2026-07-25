import { useEffect, useState } from 'react';
import {
  liveOrganizers, livePromoters, liveVenues, liveLineups, LiveApiError,
  type LiveOrganizer, type LivePromoter, type LiveVenue, type LiveLineup,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Directory (live)';
type Row = LiveOrganizer | LivePromoter | LiveVenue | LiveLineup;
type Kind = 'organizer' | 'promoter' | 'venue' | 'lineup';

const KINDS: { key: Kind; label: string }[] = [
  { key: 'organizer', label: 'Organizers' },
  { key: 'promoter', label: 'Promoters' },
  { key: 'venue', label: 'Venues' },
  { key: 'lineup', label: 'Line-ups' },
];

const nameOf = (kind: Kind, r: Row) => (kind === 'organizer' ? (r as LiveOrganizer).brandName : (r as LivePromoter | LiveVenue | LiveLineup).name);
const subOf = (kind: Kind, r: Row) => {
  if (kind === 'organizer') { const o = r as LiveOrganizer; return `${o.eventsHosted} events hosted · ${o.city}`; }
  if (kind === 'promoter') { const p = r as LivePromoter; return `${p.eventsPromoted} events promoted · ${p.city}`; }
  if (kind === 'venue') { const v = r as LiveVenue; return `${v.type} · capacity ${v.capacity} · ${v.city}`; }
  const l = r as LiveLineup;
  return `${l.category} · ${l.city}`;
};

const API: Record<Kind, { list: () => Promise<Row[]>; setVerified: (id: string, v: boolean) => Promise<unknown> }> = {
  organizer: liveOrganizers,
  promoter: livePromoters,
  venue: liveVenues,
  lineup: liveLineups,
};

/** Real organizer/promoter/venue/lineup directory — list + real verified
 * toggle (backs "verified ✓" badges shown across the guest-facing site).
 * Full profile editing (bio, links, SEO, etc.) stays on the existing mock
 * OrganizerEdit/PromoterEdit/LineupEdit pages for now — same disclosed
 * boundary as the other live pages this phase. */
export default function DirectoryLive() {
  const session = useLiveSession();
  const { token } = session;

  const [kind, setKind] = useState<Kind>('organizer');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = (k: Kind) => {
    setLoading(true);
    setErr('');
    API[k]
      .list()
      .then(setRows)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, kind]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const toggleVerified = async (r: Row) => {
    try {
      await API[kind].setVerified(r.id, !r.verified);
      load(kind);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      <div className="tiny hint" style={{ marginTop: -6 }}>
        Real directory rows — the verified toggle is the real ✓ badge shown across the guest site. Full profile
        editing still goes through the existing mock edit pages.
      </div>

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {KINDS.map((k) => (
          <button key={k.key} className={kind === k.key ? 'on' : ''} onClick={() => setKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 500 }}>
          <span style={{ flex: 2 }}>Name</span>
          <span style={{ flex: 1.6 }}>Details</span>
          <span style={{ flex: 0.9 }}>Verified</span>
          <span style={{ flex: 0.9 }}>Action</span>
        </div>
        {rows.length === 0 && !loading && <div className="trow muted">Nothing here yet.</div>}
        {rows.map((r) => (
          <div key={r.id} className="trow" style={{ minWidth: 500 }}>
            <span style={{ flex: 2, fontWeight: 700 }}>{nameOf(kind, r)}</span>
            <span style={{ flex: 1.6 }} className="tiny muted">{subOf(kind, r)}</span>
            <span style={{ flex: 0.9 }}>
              <span className={`tag ${r.verified ? 'tag-green' : ''}`}>{r.verified ? 'verified ✓' : 'unverified'}</span>
            </span>
            <span style={{ flex: 0.9 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleVerified(r)}>
                {r.verified ? 'Unverify' : 'Verify'}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
