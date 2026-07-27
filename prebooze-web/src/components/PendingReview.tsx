import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { roleLabel, roleOnboardingPath, type Role } from '../lib/roles';
import { useApp } from '../store/AppContext';
import { auth } from '../api';
import { isBackendEnabled } from '../api/client';

const POLL_MS = 30000;

/** Shown in place of the console while an elevated-role application is
 * waiting on manual review — every organizer/promoter/lineup/venue signup
 * is reviewed by the Prebooze team; nothing here is automatic on the review
 * side. The "unlocks automatically" promise below IS real though: AppContext
 * only fetches /me once on mount, so without this poll an approval landing
 * while this exact tab is sitting open would never be picked up short of a
 * manual reload — this closes that gap by re-checking every 30s and pushing
 * any change straight into the shared user object. */
export default function PendingReview({ role }: { role: Role }) {
  const { updateUser } = useApp();

  useEffect(() => {
    if (!isBackendEnabled()) return;
    const id = setInterval(() => {
      auth.me().then(updateUser).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page">
      <div className="container center" style={{ padding: '72px 0' }}>
        <div className="card card-shadow" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>◌</div>
          <h1 style={{ fontSize: 22, marginTop: 8 }}>Application under review</h1>
          <p className="muted" style={{ margin: '10px 0 6px' }}>
            Your {roleLabel(role)} application is being reviewed manually by our team — usually within 24 hours.
            You'll get a WhatsApp message the moment a decision is made.
          </p>
          <p className="tiny muted-2" style={{ marginBottom: 18 }}>
            The console unlocks automatically once you're approved — no need to check back here.
          </p>
          <Link to="/" className="btn btn-ghost">Back to home</Link>
        </div>
      </div>
    </main>
  );
}

/** Shown when a previous application was rejected — offers a clean re-apply path. */
export function RejectedReview({ role, reason, onboardingOverride }: { role: Role; reason?: string; onboardingOverride?: string }) {
  return (
    <main className="page">
      <div className="container center" style={{ padding: '72px 0' }}>
        <div className="card card-shadow" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>✕</div>
          <h1 style={{ fontSize: 22, marginTop: 8 }}>Application not approved</h1>
          <p className="muted" style={{ margin: '10px 0 6px' }}>
            Your {roleLabel(role)} application wasn't approved this time.
            {reason ? <> Reason: <span style={{ color: 'var(--text)' }}>{reason}</span></> : null}
          </p>
          <p className="tiny muted-2" style={{ marginBottom: 18 }}>You're welcome to fix the issue and reapply.</p>
          <Link to={onboardingOverride ?? roleOnboardingPath[role]} className="btn btn-pri">Reapply →</Link>
        </div>
      </div>
    </main>
  );
}
