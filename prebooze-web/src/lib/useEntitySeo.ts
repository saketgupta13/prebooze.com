import { useEffect, useState } from 'react';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';

type EntitySeo = { title: string; description: string; keywords: string };
type EntityKind = 'venue' | 'organizer' | 'promoter' | 'lineup';

const FETCH: Record<EntityKind, (id: string) => Promise<EntitySeo>> = {
  venue: catalog.venueSeo,
  organizer: catalog.organizerSeo,
  promoter: catalog.promoterSeo,
  lineup: catalog.lineupSeo,
};

/** Organizer/Venue/Promoter/Lineup profile pages are still mock-data pages
 * (see prebooze-web architecture notes) — their id/slug rarely matches a
 * real backend row, so this quietly returns null (useSeo then falls back to
 * fallbackTitle, exactly as if no override existed) unless the viewed
 * entity genuinely exists in the live PlatformSettings-backed directory. */
export function useEntitySeo(kind: EntityKind, id: string | undefined): EntitySeo | null {
  const [seo, setSeo] = useState<EntitySeo | null>(null);
  useEffect(() => {
    setSeo(null);
    if (!id || !isBackendEnabled()) return;
    FETCH[kind](id).then((s) => setSeo(s)).catch(() => {});
  }, [kind, id]);
  return seo;
}
