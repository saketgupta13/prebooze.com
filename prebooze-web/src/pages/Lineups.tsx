import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LINEUPS } from '../data/mock';
import { useApp } from '../store/AppContext';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { LineupProfile } from '../types';
import { featuredRefs, featuredFirst } from '../lib/featured';
import DirectoryCard from '../components/DirectoryCard';

/** Public directory of line-up artists — DJs, bands, comedians and more. */
export default function Lineups() {
  const { city, following, toggleFollow, featured } = useApp();
  const feat = featuredRefs(featured, 'lineup', city);

  const [liveLineups, setLiveLineups] = useState<LineupProfile[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.lineups(city).then(setLiveLineups).catch(() => setLiveLineups([]));
  }, [city]);

  const pool = liveLineups ?? LINEUPS.filter((l) => l.city === city);
  const cats = ['All', ...Array.from(new Set(pool.map((l) => l.category)))];
  const [catF, setCatF] = useState('All');
  const list = featuredFirst(
    [...pool].filter((l) => catF === 'All' || l.category === catF).sort((a, b) => b.followers - a.followers),
    (l) => l.slug,
    feat
  );

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Line-ups
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Line-ups in {city} 🎤</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          Follow the artists, DJs and acts you love — catch them before their next set sells out.
        </p>

        <div className="chip-row" style={{ marginBottom: 18 }}>
          {cats.map((c) => (
            <button key={c} className={`chip ${catF === c ? 'on' : ''}`} onClick={() => setCatF(c)}>{c}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
          {list.map((l) => {
            const key = 'lineup:' + l.slug;
            const isFollowing = following.includes(key);
            return (
              <DirectoryCard
                key={l.slug}
                to={`/lineup/${l.slug}`}
                hue={l.hue}
                avatarText={l.emoji}
                name={l.name}
                verified={l.verified}
                meta={`${l.category} · ${l.city}`}
                bio={l.bio}
                featured={feat.has(l.slug)}
                stats={<><b>{l.followers.toLocaleString('en-IN')}</b> followers · <b>{l.eventsPlayed}</b> shows</>}
                action={
                  <button className={`btn btn-sm btn-block ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(key)}>
                    {isFollowing ? 'Following ✓' : '+ Follow'}
                  </button>
                }
              />
            );
          })}
        </div>
        {list.length === 0 && <div className="empty">No line-ups in {city} yet.</div>}
      </div>
    </main>
  );
}
