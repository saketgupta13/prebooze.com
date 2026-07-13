import type { Person } from '../types';

/** Social-proof strip — "Aisha, Rohit +2 you follow are going to their events". */
export default function FriendsProof({ people, suffix, style }: { people: Person[]; suffix: string; style?: React.CSSProperties }) {
  if (people.length === 0) return null;
  const names = people.slice(0, 2).map((p) => p.name.split(' ')[0]).join(', ');
  const extra = people.length > 2 ? ` +${people.length - 2}` : '';
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', ...style }}>
      <div style={{ display: 'flex' }}>
        {people.slice(0, 5).map((p, i) => (
          <span key={p.id} title={p.name} style={{
            width: 26, height: 26, borderRadius: '50%', background: `hsl(${p.avatarHue} 55% 45%)`,
            color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, marginLeft: i ? -8 : 0, border: '2px solid var(--bg)',
          }}>{p.name[0]}</span>
        ))}
      </div>
      <span className="small">
        <b>{names}</b>{extra} you follow {people.length === 1 ? 'is' : 'are'} {suffix}
      </span>
    </div>
  );
}
