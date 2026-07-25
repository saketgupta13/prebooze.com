import { Link, useParams } from 'react-router-dom';
import { BLOG_POSTS, blogBySlug, eventBySlug } from '../../data/mock';
import Poster from '../../components/Poster';
import EventCard from '../../components/EventCard';
import { useSeo } from '../../lib/useSeo';

export default function BlogPost() {
  const { slug } = useParams();
  const post = blogBySlug(slug ?? '');
  useSeo(null, post?.title);

  if (!post) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Post not found</h1>
          <Link to="/blog" className="btn btn-pri" style={{ marginTop: 18 }}>← All posts</Link>
        </div>
      </main>
    );
  }

  const linkedEvents = post.linkedEventSlugs
    .map((s) => eventBySlug(s))
    .filter((e): e is NonNullable<typeof e> => Boolean(e) && e!.status === 'approved');
  const more = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="breadcrumb">
          <Link to="/blog">← The Prebooze Blog</Link>
        </div>

        <span className="tag">{post.tag}</span>
        <h1 style={{ fontSize: 30, margin: '10px 0 8px', letterSpacing: '-0.4px' }}>{post.title}</h1>
        <div className="small muted" style={{ marginBottom: 18 }}>
          {post.author} · {post.date} · {post.readMins} min read · {post.views} views
        </div>

        <Poster hue={post.hue} emoji="📰" label="cover image 16:9" variant="landscape" />

        <article style={{ margin: '24px 0', display: 'grid', gap: 16 }}>
          {post.body.map((para, i) => (
            <p key={i} className="muted" style={{ fontSize: 15.5, lineHeight: 1.75, color: i === 0 ? 'var(--text)' : undefined }}>
              {para}
            </p>
          ))}
        </article>

        {linkedEvents.length > 0 && (
          <section className="section">
            <div className="section-hd">
              <h2>Events in this story</h2>
            </div>
            <div className="grid-3">
              {linkedEvents.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </section>
        )}

        <div className="hr" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="small muted">Share:</span>
          <span className="icon-round">ig</span>
          <span className="icon-round">x</span>
          <span className="icon-round">wa</span>
          <span style={{ flex: 1 }} />
          <Link to="/blog" className="link small bold">← All posts</Link>
        </div>

        <section className="section">
          <div className="section-hd">
            <h2>Keep reading</h2>
          </div>
          <div className="grid-2">
            {more.map((p) => (
              <Link key={p.slug} to={`/blog/${p.slug}`} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 84, flexShrink: 0 }}>
                  <Poster hue={p.hue} emoji="📰" variant="landscape" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 14 }}>{p.title}</h3>
                  <div className="meta">{p.author} · {p.readMins} min</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
