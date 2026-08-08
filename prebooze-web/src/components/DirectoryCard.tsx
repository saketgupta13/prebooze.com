import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { stripHtml } from '../lib/richtext';

/** Consistent directory card for people / promoters / organizers / line-ups.
 * Plain card background (no banners), avatar, bio + stats + action. */
export default function DirectoryCard({
  to, hue, avatarText, avatarImage, name, verified, meta, bio, stats, extra, action, featured,
}: {
  to: string;
  hue: number;
  avatarText: string; // initial or emoji, shown when avatarImage is unset
  avatarImage?: string | null; // real uploaded logo — takes over from avatarText when present
  name: string;
  verified?: boolean;
  meta: string;
  bio?: string;
  stats?: ReactNode;
  extra?: ReactNode;
  action?: ReactNode;
  featured?: boolean;
}) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', borderColor: featured ? 'var(--accent)' : undefined, position: 'relative' }}>
      {featured && (
        <span className="badge badge-accent" style={{ position: 'absolute', top: 12, right: 12, fontSize: 10 }}>★ Featured</span>
      )}
      <Link to={to} style={{ width: 'fit-content' }} aria-label={name}>
        {avatarImage ? (
          <img
            src={avatarImage}
            alt=""
            width={46}
            height={46}
            loading="lazy"
            decoding="async"
            style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
          />
        ) : (
          <span style={{
            width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
            background: `hsl(${hue} 55% 45%)`, color: '#fff', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18,
          }}>{avatarText}</span>
        )}
      </Link>
      <Link to={to} style={{ textDecoration: 'none', color: 'inherit', marginTop: 10 }}>
        <h3 style={{ fontSize: 15.5 }}>{name} {verified && <span className="verified">✓</span>}</h3>
      </Link>
      <div className="tiny muted-2">{meta}</div>
      {bio && (
        <p className="tiny muted" style={{ margin: '8px 0 0', minHeight: '2.6em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {stripHtml(bio)}
        </p>
      )}
      {stats && <div className="tiny muted-2" style={{ marginTop: 8 }}>{stats}</div>}
      {extra && <div style={{ marginTop: 8 }}>{extra}</div>}
      <div style={{ flex: 1 }} />
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
