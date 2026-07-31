import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { content } from '../../api';
import { isBackendEnabled } from '../../api/client';
import type { CmsPolicy, CmsPolicySummary } from '../../types';
import { PageLoader } from '../../components/Loader';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Real GET /policies + GET /policies/:slug (admin's Content > Policies) —
 * this used to be entirely hardcoded section headings with one literal
 * "This section is placeholder copy from the design handoff" paragraph
 * repeated under every one of them, on every legal page on the site. Real
 * Policy.slug is stored as the full path ("/legal/terms"), not the bare
 * :page param, so the lookup key is reconstructed to match. */
export default function Legal() {
  const { page } = useParams();
  const slug = `/legal/${page ?? 'terms'}`;

  const [doc, setDoc] = useState<CmsPolicy | null>(null);
  const [all, setAll] = useState<CmsPolicySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isBackendEnabled()) return;
    setLoading(true);
    content.policy(encodeURIComponent(slug)).then(setDoc).catch(() => setDoc(null)).finally(() => setLoading(false));
    content.policies().then(setAll).catch(() => {});
  }, [slug]);

  if (loading) return <PageLoader />;

  if (!doc) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Page not found</h1>
          <Link to="/" className="btn btn-pri" style={{ marginTop: 18 }}>Home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container legal-grid">
        <aside className="toc card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }} className="muted">
            On this page
          </h3>
          {doc.sections.map((s, i) => (
            <a key={s.heading} href={`#s${i + 1}`}>
              {i + 1}. {s.heading}
            </a>
          ))}
          <div className="hr" />
          {all.map((p) => (
            <Link key={p.slug} to={p.slug} className={p.slug === slug ? 'accent' : ''}>
              {p.title}
            </Link>
          ))}
        </aside>

        <article>
          <h1 style={{ fontSize: 26 }}>{doc.title}</h1>
          <p className="muted-2 small" style={{ margin: '6px 0 26px' }}>
            Last updated: {fmtDate(doc.updatedAt)}
          </p>
          {doc.sections.map((s, i) => (
            <section key={s.heading} id={`s${i + 1}`} style={{ marginBottom: 26 }}>
              <h2 style={{ fontSize: 17, marginBottom: 8 }}>
                {i + 1}. {s.heading}
              </h2>
              <div className="muted small rich-text" dangerouslySetInnerHTML={{ __html: s.body }} />
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
