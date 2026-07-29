import { useEffect } from 'react';
import { usePlatformInfo } from './usePlatformInfo';

const DEFAULT_TITLE = "Prebooze — Your city's events, one tap away";
const DEFAULT_DESCRIPTION = 'Prebooze — find your next night out. Book tickets to concerts, comedy, festivals and parties from verified organizers. WhatsApp tickets, QR entry.';
// Square, not the wide wordmark logo — a 1531×318 wordmark crops badly in
// social preview cards (ideal is ~1.91:1 landscape; square is the next-best
// fallback), so this 512×512 mark is what unfurls when a page has no real
// entity image of its own (event poster / venue-organizer-lineup logo).
const DEFAULT_IMAGE = 'https://prebooze.com/prebooze-mark.png';

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

function setPropertyTag(property: string, content: string) {
  if (!content) return;
  let tag = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
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
 * override yet — better than falling straight to the generic site title.
 *
 * `shareImage` drives the Open Graph/Twitter Card image — what actually
 * shows up when a guest shares an event/venue/organizer/promoter/lineup
 * link on WhatsApp or social. Callers pass the entity's own real image
 * (Event.posterUrl, Venue/Organizer/Lineup.logoUrl); the site mark is only
 * the fallback for pages with no entity image of their own. */
export function useSeo(
  seo?: { title?: string; description?: string; keywords?: string | string[] } | null,
  fallbackTitle?: string,
  shareImage?: string | null,
) {
  const { siteSeo } = usePlatformInfo();
  const seoKeywords = Array.isArray(seo?.keywords) ? seo.keywords.join(', ') : seo?.keywords;
  const title = seo?.title?.trim() || (fallbackTitle ? `${fallbackTitle} | Prebooze` : '') || siteSeo.title || DEFAULT_TITLE;
  const description = seo?.description?.trim() || siteSeo.description || DEFAULT_DESCRIPTION;
  const keywords = seoKeywords?.trim() || siteSeo.keywords || '';
  const image = shareImage?.trim() || DEFAULT_IMAGE;

  useEffect(() => {
    document.title = title;
    setMetaTag('description', description);
    if (keywords) setMetaTag('keywords', keywords);

    const url = window.location.origin + window.location.pathname;
    setPropertyTag('og:type', 'website');
    setPropertyTag('og:site_name', 'Prebooze');
    setPropertyTag('og:url', url);
    setPropertyTag('og:title', title);
    setPropertyTag('og:description', description);
    setPropertyTag('og:image', image);
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', image);
  }, [title, description, keywords, image]);
}
