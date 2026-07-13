import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/** Consistent directory card for people / promoters / organizers / line-ups.
 * Solid colour header (no gradients), overlapping avatar, bio + stats + action. */
export default function DirectoryCard({
  to, hue, avatarText, name, verified, meta, bio, stats, extra, action,
}: {
  to: string;
  hue: number;
  avatarText: string; // initial or emoji
  name: string;
  verified?: boolean;
  meta: string;
  bio?: string;
  stats?: ReactNode;
  extra?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 48, background: `hsl(${hue} 32% 20%)` }} />
      <div style={{ padding: '0 16px 16px', marginTop: -23, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Link to={to} style={{ width: 'fit-content' }}>
          <span style={{
            width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
            background: `hsl(${hue} 55% 45%)`, color: '#fff', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18,
            border: '3px solid var(--bg)',
          }}>{avatarText}</span>
        </Link>
        <Link to={to} style={{ textDecoration: 'none', color: 'inherit', marginTop: 8 }}>
          <h3 style={{ fontSize: 15.5 }}>{name} {verified && <span className="verified">✓</span>}</h3>
        </Link>
        <div className="tiny muted-2">{meta}</div>
        {bio && (
          <p className="tiny muted" style={{ margin: '8px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {bio}
          </p>
        )}
        {stats && <div className="tiny muted-2" style={{ marginTop: 8 }}>{stats}</div>}
        {extra && <div style={{ marginTop: 8 }}>{extra}</div>}
        <div style={{ flex: 1 }} />
        {action && <div style={{ marginTop: 14 }}>{action}</div>}
      </div>
    </div>
  );
}
