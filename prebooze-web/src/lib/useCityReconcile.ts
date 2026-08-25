import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toCitySlug, absoluteUrl } from './urls';

/** An entity page's URL must reflect that entity's OWN real city, not
 * whatever city the visitor is currently browsing — a Hyderabad venue's
 * canonical URL always says Hyderabad, the same way BookMyShow's do,
 * regardless of what city the visitor navigated from. Covers three cases
 * with one mechanism: (1) the bare/legacy unprefixed URL (no :city param
 * at all — always mismatches once the entity's real city loads, so always
 * redirects to the prefixed canonical), (2) a correct-city URL (no-op),
 * (3) a wrong-city URL, e.g. a Hyderabad venue reached via /nagpur/venues/:id
 * (redirects to the right one).
 *
 * Call with the entity's own city name and its correct city-prefixed path
 * once both are known (pass undefined while the entity is still loading —
 * this is a no-op until then). */
export function useCityReconcile(entityCityName: string | undefined, correctPath: string | undefined): void {
  const { city: urlCitySlug } = useParams<{ city?: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!entityCityName || !correctPath) return;
    if (toCitySlug(entityCityName) === urlCitySlug) return;

    // Write the corrected canonical immediately, ahead of the navigate()
    // below actually landing — App.tsx's CanonicalUrl re-derives from
    // `pathname` on every route change and will reaffirm the same value
    // once navigate() completes, so this is only closing the brief window
    // between "we know the right URL" and "the browser is actually there."
    let tag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!tag) {
      tag = document.createElement('link');
      tag.setAttribute('rel', 'canonical');
      document.head.appendChild(tag);
    }
    tag.setAttribute('href', absoluteUrl(correctPath));

    // Preserve any query string (e.g. a review-reminder's ?event=, utm
    // params) — this redirect only corrects the path's city segment, it
    // isn't meant to drop whatever the visitor arrived with.
    navigate({ pathname: correctPath, search: window.location.search }, { replace: true });
  }, [entityCityName, correctPath, urlCitySlug, navigate]);
}
