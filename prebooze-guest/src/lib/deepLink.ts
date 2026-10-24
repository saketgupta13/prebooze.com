import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

/** A promoter's shared event link, in either form:
 *   - custom scheme (works today, no domain setup needed):
 *     prebooze-guest://event/<slug>?ref=<promoterSlug>&via=<subHandle>
 *   - the real web URL (needs apple-app-site-association +
 *     assetlinks.json hosted on prebooze.com before iOS/Android will ever
 *     actually hand this to the app instead of opening it in a browser —
 *     that's infra work outside this repo; the parsing below is ready for
 *     it the moment that's live):
 *     https://prebooze.com/<city>/events/<slug>?ref=<promoterSlug>&via=<subHandle>
 * Both forms are parsed identically — the event slug is always the last
 * path segment, ref/via are always query params. */
export function navigateToDeepLink(
  ref: NavigationContainerRefWithCurrent<RootStackParamList>,
  url: string,
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  // Custom scheme puts "event" in the host (prebooze-guest://event/<slug>);
  // the real web URL puts "events" as a path segment
  // (https://prebooze.com/<city>/events/<slug>).
  const isCustomScheme = parsed.hostname === 'event';
  const isWebUrl = segments[segments.length - 2] === 'events';
  if (!isCustomScheme && !isWebUrl) return;
  const slug = segments[segments.length - 1];
  if (!slug) return;

  const promoterRef = parsed.searchParams.get('ref') ?? undefined;
  const promoterVia = parsed.searchParams.get('via') ?? undefined;
  ref.navigate('EventDetail', { slug, ref: promoterRef, via: promoterVia });
}
