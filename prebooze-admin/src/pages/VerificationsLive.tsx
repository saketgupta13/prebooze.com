import { useEffect, useState } from 'react';
import { liveKyc, LiveApiError, type LiveKycApplication } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Verifications (live)';
const TABS: { key: 'all' | LiveKycApplication['status']; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];
const KIND_LABEL: Record<string, string> = { organizer: 'Organizer', promoter: 'Promoter', lineup: 'Line-up', venue: 'Venue' };

/** Real organizer/promoter/lineup/venue KYC review queue — the actual manual
 * review step (see BACKEND.md "Identity & KYC": elevated roles are always
 * manual, never auto-approved). Guest ID verification is separate and
 * automatic, not part of this queue. */
export default function VerificationsLive() {
  const session = useLiveSession();
  const { token } = session;

  const [apps, setApps] = useState<LiveKycApplication[]>([]);
  const [tab, setTab] = useState<'all' | LiveKycApplication['status']>('pending');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveKyc
      .list()
      .then(setApps)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const approve = async (id: string) => {
    try {
      await liveKyc.approve(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to approve');
    }
  };

  const submitReject = async (id: string) => {
    try {
      await liveKyc.reject(id, rejectReason.trim());
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reject');
    }
  };

  const list = tab === 'all' ? apps : apps.filter((a) => a.status === tab);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      <div className="tiny hint" style={{ marginTop: -6 }}>
        Real applications from real users — approving here actually grants the role (organizer/promoter/lineup/venue),
        same as the existing mock Verifications page was meant to simulate.
      </div>

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label} ({t.key === 'all' ? apps.length : apps.filter((a) => a.status === t.key).length})
          </button>
        ))}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 700 }}>
          <span style={{ flex: 1.6 }}>Applicant</span>
          <span style={{ flex: 0.9 }}>Role</span>
          <span style={{ flex: 1 }}>Submitted</span>
          <span style={{ flex: 1.6 }}>Actions</span>
        </div>
        {list.length === 0 && <div className="trow muted">Nothing in this view.</div>}
        {list.map((a) => (
          <div key={a.id} className="trow" style={{ minWidth: 700, flexWrap: 'wrap' }}>
            <span style={{ flex: 1.6 }}>
              <div style={{ fontWeight: 700 }}>{a.user.name || a.user.phone}</div>
              <div className="tiny muted">{a.user.phone}{a.user.email ? ` · ${a.user.email}` : ''}</div>
              {a.status === 'rejected' && a.reviewNote && (
                <div className="tiny" style={{ color: 'var(--red)' }}>reason: {a.reviewNote}</div>
              )}
            </span>
            <span style={{ flex: 0.9 }} className="muted">{KIND_LABEL[a.kind] ?? a.kind}</span>
            <span style={{ flex: 1 }} className="tiny muted">{new Date(a.createdAt).toLocaleDateString('en-IN')}</span>
            <span style={{ flex: 1.6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {a.status === 'pending' ? (
                rejectingId === a.id ? (
                  <>
                    <input
                      className="input"
                      style={{ width: 140, padding: '4px 6px' }}
                      placeholder="reason"
                      value={rejectReason}
                      onChange={(ev) => setRejectReason(ev.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-danger btn-sm" onClick={() => submitReject(a.id)}>Confirm</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setRejectingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-pri btn-sm" onClick={() => approve(a.id)}>Approve</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setRejectingId(a.id)}>Reject</button>
                  </>
                )
              ) : (
                <span className="tiny muted">{a.status}{a.reviewedBy ? ` by ${a.reviewedBy}` : ''}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
