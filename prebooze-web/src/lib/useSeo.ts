import { useEffect } from 'react';
import { usePlatformInfo } from './usePlatformInfo';

const DEFAULT_TITLE = "Prebooze — Your city's events, one tap away";
const DEFAULT_DESCRIPTION = 'Prebooze — find your next night out. Book tickets to concerts, comedy, festivals and parties from verified organizers. WhatsApp tickets, QR entry.';

function setMetaTag(name: string, content: string) {
  if (!content) return;
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/** The whole SEO chain used to dead-end here: every entity (event, venue,
 * organizer, blog post...) carries its own `seo` object, admin has a real
 * editor for it (`SeoFields`), the backend returns it — and nothing in
 * prebooze-web ever read it. `document.title`/meta description were one
 * static string in index.html for the entire session, every route.
 *
 * Resolution order: this page's own `seo` > site-wide `siteSeo` (Settings →
 * SEO, admin-editable) > the static index.html defaults. `fallbackTitle` is
 * for pages with a natural title (an event/organizer name) but no admin SEO
 * override yet — better than falling straight to the generic site title. */
export function useSeo(seo?: { title?: string; description?: string; keywords?: string | string[] } | null, fallbackTitle?: string) {
  const { siteSeo } = usePlatformInfo();
  const seoKeywords = Array.isArray(seo?.keywords) ? seo.keywords.join(', ') : seo?.keywords;
  const title = seo?.title?.trim() || (fallbackTitle ? `${fallbackTitle} | Prebooze` : '') || siteSeo.title || DEFAULT_TITLE;
  const description = seo?.description?.trim() || siteSeo.description || DEFAULT_DESCRIPTION;
  const keywords = seoKeywords?.trim() || siteSeo.keywords || '';

  useEffect(() => {
    document.title = title;
    setMetaTag('description', description);
    if (keywords) setMetaTag('keywords', keywords);
  }, [title, description, keywords]);
}
