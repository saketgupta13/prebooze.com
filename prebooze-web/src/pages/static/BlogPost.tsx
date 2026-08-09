import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { content } from '../../api';
import { isBackendEnabled } from '../../api/client';
import type { CmsBlog, CmsBlogSummary } from '../../types';
import Poster from '../../components/Poster';
import { PageLoader } from '../../components/Loader';
import ShareButton from '../../components/ShareButton';
import { stripHtml } from '../../lib/richtext';
import { useSeo } from '../../lib/useSeo';
import { useJsonLd } from '../../lib/useJsonLd';
import { buildBlogPostSchema, buildBreadcrumbSchema } from '../../lib/schema';

const hueFromId = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const readMins = (html: string) => Math.max(1, Math.round(stripHtml(html).trim().split(/\s+/).filter(Boolean).length / 200));

/** Real GET /blogs/:id — the route param is still named :slug (no route
 * table change needed) but its value is a real Blog.id now, same pattern
 * OrganizerProfile.tsx etc. already use (param name ≠ what it looks up by). */
export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<CmsBlog | null>(null);
  const [more, setMore] = useState<CmsBlogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useSeo(null, post?.title);
  useJsonLd(post ? buildBlogPostSchema(post) : null);
  useJsonLd(
    post
      ? buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${post.id}` },
        ])
      : null,
  );

  useEffect(() => {
    if (!isBackendEnabled() || !slug) return;
    setLoading(true);
    content.blog(slug).then(setPost).catch(() => setPost(null)).finally(() => setLoading(false));
    content.blogs().then((all) => setMore(all.filter((p) => p.id !== slug).slice(0, 2))).catch(() => {});
  }, [slug]);

  if (loading) return <PageLoader />;

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

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="breadcrumb">
          <Link to="/blog">← The Prebooze Blog</Link>
        </div>

        {post.category && <span className="tag">{post.category}</span>}
        <h1 style={{ fontSize: 30, margin: '10px 0 8px', letterSpacing: '-0.4px' }}>{post.title}</h1>
        <div className="small muted" style={{ marginBottom: 18 }}>
          {fmtDate(post.updatedAt)} · {readMins(post.content ?? '')} min read
        </div>

        <Poster hue={hueFromId(post.id)} emoji="📰" label="cover image 16:9" variant="landscape" imageUrl={post.bannerUrl} alt={post.title} eager />

        <article
          className="rich-text"
          style={{ margin: '24px 0', fontSize: 15.5, lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: post.content ?? '' }}
        />

        <div className="hr" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ShareButton path={`/blog/${post.id}`} text={`${post.title} — on the Prebooze blog:`} />
          <span style={{ flex: 1 }} />
          <Link to="/blog" className="link small bold">← All posts</Link>
        </div>

        {more.length > 0 && (
          <section className="section">
            <div className="section-hd">
              <h2>Keep reading</h2>
            </div>
            <div className="grid-2">
              {more.map((p) => (
                <Link key={p.id} to={`/blog/${p.id}`} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 84, flexShrink: 0 }}>
                    <Poster hue={hueFromId(p.id)} emoji="📰" variant="landscape" imageUrl={p.bannerUrl} alt={p.title} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 14 }}>{p.title}</h3>
                    <div className="meta">{fmtDate(p.updatedAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
