import { Link } from 'react-router-dom';
import { roleLabel, roleOnboardingPath, type Role } from '../lib/roles';

/** Shown in place of the console while an elevated-role application is
 * waiting on manual review — every organizer/promoter/lineup/venue signup
 * is reviewed by the Prebooze team; nothing here is automatic. */
export default function PendingReview({ role }: { role: Role }) {
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
