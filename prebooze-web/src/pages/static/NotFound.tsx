import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../../lib/useSeo';
import { useApp } from '../../store/AppContext';
import { cityHome, cityBrowse } from '../../lib/urls';

/** The SPA's catch-all used to silently redirect any unmatched path to
 * home — real for a person clicking a stale link, but wrong for search
 * engines: the server returns 200 for literally any path (no way for
 * nginx to know which of React Router's routes are valid without
 * duplicating that whole route table), so an invalid URL looked exactly
 * like a real page to Google, and old/dead links stayed indexed forever
 * instead of dropping out. A server-side 404 isn't possible for a client-
 * routed SPA, but a `noindex` meta tag is Google's own documented
 * workaround (a "soft 404") — cleared again on unmount so it never leaks
 * onto whatever real page gets visited next. */
export default function NotFound() {
  const { city } = useApp();
  useSeo(null, 'Page not found');

  useEffect(() => {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = tag?.getAttribute('content') ?? null;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'robots');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', 'noindex, follow');
    return () => {
      if (previous) tag!.setAttribute('content', previous);
    };
  }, []);

  return (
    <main className="page" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔎</div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Page not found</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          That link's outdated, or the page moved. Let's get you back on track.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link to={cityHome(city)} className="btn btn-pri">Go home</Link>
          <Link to={cityBrowse(city)} className="btn btn-ghost">Browse events</Link>
        </div>
      </div>
    </main>
  );
}
