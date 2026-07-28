import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtTime } from '../../data/mock';
import PromoteCard from '../../components/PromoteCard';
import Loader from '../../components/Loader';
import { lineup as lineupApi } from '../../api';
import { ApiError } from '../../api/client';
import type { Event, LineupProfile } from '../../types';

/** Real line-up overview — GET /lineup/me + GET /lineup/events. Reaching
 * this page at all means LineupLayout.tsx already confirmed the role is
 * approved (pending/rejected applicants get redirected before this ever
 * mounts), so there's no "pending review" state to show here — unlike
 * venue, whose listing row exists (and is reachable) before approval. */
export default function LineupDashboard() {
  const [profile, setProfile] = useState<LineupProfile | null>(null);
  const [events, setEvents] = useState<(Event & { myRole?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([lineupApi.me(), lineupApi.events()])
      .then(([p, evs]) => { setProfile(p); setEvents(evs); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (err || !profile) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Profile not found'}</div>;

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.date).getTime() >= now);
  const past = events.filter((e) => new Date(e.date).getTime() < now);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>Hey, {profile.name} 🎤</h1>
        <span className="badge badge-ok">Verified ✓</span>
      </div>
      <p className="muted small" style={{ margin: '4px 0 18px' }}>
        {profile.category} · {profile.city || 'city not set'}
      </p>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="l">Category</div><div className="v">{profile.category}</div></div>
        <div className="kpi"><div className="l">Based in</div><div className="v">{profile.city || '—'}</div></div>
        <div className="kpi"><div className="l">Tagged in</div><div className="v">{events.length}<span className="muted small"> events</span></div></div>
        <div className="kpi"><div className="l">Followers</div><div className="v">{profile.followers.toLocaleString('en-IN')}</div></div>
      </div>

      <PromoteCard type="lineup" refId={profile.slug} city={profile.city || 'All'} label="your artist profile" />

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <h3>Profile</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/artist/profile" className="btn btn-pri btn-sm">Edit profile →</Link>
            <Link to={`/lineup/${profile.slug}`} className="btn btn-ghost btn-sm">View public profile ↗</Link>
          </div>
        </div>
        <div className="kv"><span className="k">Username</span><span>@{profile.slug}</span></div>
        <div className="kv"><span className="k">Links</span><span>{profile.links.length ? profile.links.join(', ') : '—'}</span></div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Events you're tagged in</h3>
        {events.length === 0 ? (
          <div className="muted small">You're not on any line-ups yet. Organizers add you to their events — they'll appear here.</div>
        ) : (
          <>
            {upcoming.map((e) => (
              <div key={e.id} className="evrow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small">{e.title} {e.myRole && <span className="muted" style={{ fontWeight: 400 }}>· {e.myRole}</span>}</div>
                  <div className="tiny muted-2">{fmtDate(e.date)} · {fmtTime(e.date)} · {e.venue?.name}, {e.venue?.city}</div>
                </div>
                <Link to={`/events/${e.slug}`} className="btn btn-ghost btn-sm">View →</Link>
              </div>
            ))}
            {past.length > 0 && (
              <div className="tiny muted-2" style={{ marginTop: 10 }}>{past.length} past event{past.length === 1 ? '' : 's'}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
