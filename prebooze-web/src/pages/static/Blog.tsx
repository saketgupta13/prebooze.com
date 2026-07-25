import { Link } from 'react-router-dom';
import { BLOG_POSTS } from '../../data/mock';
import Poster from '../../components/Poster';
import { useSeo } from '../../lib/useSeo';

/** Guest-facing blog — the reading side of the admin Blogs CMS (new page, not in the handoff). */
export default function Blog() {
  useSeo(null, 'Blog');
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <main className="page">
      <div className="container">
        <section className="hero" style={{ padding: '38px 40px' }}>
          <span className="badge badge-accent">The Prebooze Blog</span>
          <h1 style={{ marginTop: 12, fontSize: 30 }}>Stories from your city's nights out</h1>
          <p>City guides, organizer playbooks and venue spotlights — fresh every week.</p>
        </section>

        {/* Featured post */}
        <Link to={`/blog/${featured.slug}`} className="card" style={{ display: 'flex', gap: 22, alignItems: 'stretch', marginBottom: 26, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px' }}>
            <Poster hue={featured.hue} emoji="📰" label="cover 16:9" variant="landscape" />
          </div>
          <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
            <span className="tag" style={{ width: 'fit-content' }}>{featured.tag}</span>
            <h2 style={{ fontSize: 24 }}>{featured.title}</h2>
            <p className="muted" style={{ fontSize: 14 }}>{featured.excerpt}</p>
            <div className="small muted-2">
              {featured.author} · {featured.date} · {featured.readMins} min read · {featured.views} views
            </div>
            <span className="link bold small">Read the story →</span>
          </div>
        </Link>

        {/* Rest of the posts */}
        <div className="grid-3">
          {rest.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="ecard">
              <Poster hue={p.hue} emoji="📰" label="cover 16:9" variant="landscape" />
              <div>
                <span className="tag" style={{ marginBottom: 6 }}>{p.tag}</span>
                <h3 style={{ margin: '6px 0 4px' }}>{p.title}</h3>
                <div className="meta">{p.excerpt.slice(0, 90)}…</div>
                <div className="meta" style={{ marginTop: 6 }}>
                  {p.author} · {p.date} · {p.readMins} min
                </div>
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
