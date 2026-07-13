import { Link } from 'react-router-dom';
import type { Role } from '../lib/roles';
import { roleHome, roleLabel } from '../lib/roles';

/** Shown when a number already holds one elevated role and tries to take another. */
export default function RoleTaken({ has }: { has: Role }) {
  return (
    <main className="page">
      <div className="container center" style={{ padding: '72px 0' }}>
        <div className="card card-shadow" style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🔒</div>
          <h1 style={{ fontSize: 22, marginTop: 8 }}>One number, one role</h1>
          <p className="muted" style={{ margin: '10px 0 18px' }}>
            This number is already registered as a <b>{roleLabel(has)}</b>. A number can hold only one role — use a
            different number to sign up as something else.
          </p>
          <Link to={roleHome[has]} className="btn btn-pri btn-lg">Go to your {roleLabel(has)} space →</Link>
        </div>
      </div>
    </main>
  );
}
