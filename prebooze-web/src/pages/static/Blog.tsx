import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { content } from '../../api';
import { isBackendEnabled } from '../../api/client';
import type { CmsBlogSummary } from '../../types';
import Poster from '../../components/Poster';
import { useSeo } from '../../lib/useSeo';

const hueFromId = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Guest-facing blog — real GET /blogs (admin's Content > Blog posts), not
 * the hardcoded BLOG_POSTS mock array. The real Blog model is simpler than
 * the old mock (no author/readMins/views/linkedEventSlugs) so those are
 * dropped rather than faked. */
export default function Blog() {
  useSeo(null, 'Blog');
  const [posts, setPosts] = useState<CmsBlogSummary[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    content.blogs().then(setPosts).catch(() => setPosts([]));
  }, []);
  const list = posts ?? [];
  const loading = isBackendEnabled() && posts === null;

  if (loading) {
    return (
      <main className="page">
        <div className="container">
          <section className="hero" style={{ padding: '38px 40px' }}>
            <span className="badge badge-accent">The Prebooze Blog</span>
            <h1 style={{ marginTop: 12, fontSize: 30 }}>Stories from your city's nights out</h1>
            <p>City guides, organizer playbooks and venue spotlights — fresh every week.</p>
          </section>
          <div className="tiny muted">Loading…</div>
        </div>
      </main>
    );
  }

  if (list.length === 0) {
    return (
      <main className="page">
        <div className="container">
          <section className="hero" style={{ padding: '38px 40px' }}>
            <span className="badge badge-accent">The Prebooze Blog</span>
            <h1 style={{ marginTop: 12, fontSize: 30 }}>Stories from your city's nights out</h1>
            <p>City guides, organizer playbooks and venue spotlights — fresh every week.</p>
          </section>
          <div className="empty">No posts published yet — check back soon.</div>
        </div>
      </main>
    );
  }

  const [featured, ...rest] = list;

  return (
    <main className="page">
      <div className="container">
        <section className="hero" style={{ padding: '38px 40px' }}>
          <span className="badge badge-accent">The Prebooze Blog</span>
          <h1 style={{ marginTop: 12, fontSize: 30 }}>Stories from your city's nights out</h1>
          <p>City guides, organizer playbooks and venue spotlights — fresh every week.</p>
        </section>

        {/* Featured post */}
        <Link to={`/blog/${featured.id}`} className="card" style={{ display: 'flex', gap: 22, alignItems: 'stretch', marginBottom: 26, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px' }}>
            <Poster hue={hueFromId(featured.id)} emoji="📰" label="cover 16:9" variant="landscape" imageUrl={featured.bannerUrl} alt={featured.title} eager />
          </div>
          <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
            {featured.category && <span className="tag" style={{ width: 'fit-content' }}>{featured.category}</span>}
            <h2 style={{ fontSize: 24 }}>{featured.title}</h2>
            <p className="muted" style={{ fontSize: 14 }}>{featured.meta}</p>
            <div className="small muted-2">{fmtDate(featured.updatedAt)}</div>
            <span className="link bold small">Read the story →</span>
          </div>
        </Link>

        {/* Rest of the posts */}
        <div className="grid-3">
          {rest.map((p) => (
            <Link key={p.id} to={`/blog/${p.id}`} className="ecard">
              <Poster hue={hueFromId(p.id)} emoji="📰" label="cover 16:9" variant="landscape" imageUrl={p.bannerUrl} alt={p.title} />
              <div>
                {p.category && <span className="tag" style={{ marginBottom: 6 }}>{p.category}</span>}
                <h3 style={{ margin: '6px 0 4px' }}>{p.title}</h3>
                <div className="meta">{p.meta.slice(0, 90)}{p.meta.length > 90 ? '…' : ''}</div>
                <div className="meta" style={{ marginTop: 6 }}>{fmtDate(p.updatedAt)}</div>
              </div>
            </Link>
          ))}
        </div>

        <section className="section cta-banner">
          <div>
            <h3>Want your event featured? 🎤</h3>
            <p>Organizers on Prebooze get covered first — list your event and tell us the story.</p>
          </div>
          <Link to="/host" className="btn btn-pri">Host with us →</Link>
        </section>
      </div>
    </main>
  );
}
