import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../prisma.service';

const SITE = 'https://prebooze.com';
// Same fallback the client-side useSeo() uses (see prebooze-web/src/lib/useSeo.ts)
// — square, not the wide wordmark, since a 1531×318 wordmark crops badly in
// social preview cards.
const DEFAULT_IMAGE = 'https://prebooze.com/prebooze-mark.png';
const DEFAULT_DESCRIPTION = "Prebooze — find your next night out. Book tickets to concerts, comedy, festivals and parties from verified organizers. WhatsApp tickets, QR entry.";

export interface ShareData {
  title: string;
  description: string;
  image: string;
  url: string;
}

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** Server-rendered Open Graph/Twitter Card data for link-unfurl bots
 * (WhatsApp, Facebook, Twitter/X, Slack, Telegram, ...) — they read the raw
 * HTML response and never execute JavaScript, so prebooze-web's client-side
 * useSeo() (which only updates document.head after React mounts) is
 * invisible to them. ShareController serves these bots a tiny static HTML
 * page with the real per-entity title/description/image instead; nginx
 * routes only known-bot user-agents here, real browsers still get the SPA.
 * Falls back to the generic site card on any not-found/error rather than
 * failing the unfurl outright — a stale/deleted link should still preview
 * as *something*, not break. */
@Injectable()
export class ShareService {
  constructor(
    private catalog: CatalogService,
    private prisma: PrismaService,
  ) {}

  fallback(path: string): ShareData {
    return { title: 'Prebooze', description: DEFAULT_DESCRIPTION, image: DEFAULT_IMAGE, url: SITE + path };
  }

  async event(slug: string): Promise<ShareData> {
    const e = await this.catalog.event(slug);
    return {
      title: e.title,
      description: truncate(stripHtml(e.description || ''), 200) || DEFAULT_DESCRIPTION,
      image: e.posterUrl || DEFAULT_IMAGE,
      url: `${SITE}/events/${slug}`,
    };
  }

  async venue(id: string): Promise<ShareData> {
    const v = await this.catalog.venue(id);
    return {
      title: v.name,
      description: truncate(stripHtml(v.about || ''), 200) || DEFAULT_DESCRIPTION,
      image: v.logoUrl || DEFAULT_IMAGE,
      url: `${SITE}/venues/${id}`,
    };
  }

  async organizer(id: string): Promise<ShareData> {
    const o = await this.catalog.organizer(id);
    return {
      title: o.brandName,
      description: truncate(stripHtml(o.about || ''), 200) || DEFAULT_DESCRIPTION,
      image: o.logoUrl || DEFAULT_IMAGE,
      url: `${SITE}/organizers/${id}`,
    };
  }

  // Promoter has no real logo field yet (no upload flow exists — see
  // PromoterProfile.tsx / PromoterSettings.tsx, only a generated hue
  // avatar), so this always falls back to the site mark until that's built.
  async promoter(slug: string): Promise<ShareData> {
    const p = await this.catalog.promoter(slug);
    return {
      title: p.name,
      description: truncate(stripHtml(p.bio || ''), 200) || DEFAULT_DESCRIPTION,
      image: DEFAULT_IMAGE,
      url: `${SITE}/promoter/${slug}`,
    };
  }

  async lineup(slug: string): Promise<ShareData> {
    const l = await this.catalog.lineup(slug);
    return {
      title: l.name,
      description: truncate(stripHtml(l.bio || ''), 200) || DEFAULT_DESCRIPTION,
      image: l.logoUrl || DEFAULT_IMAGE,
      url: `${SITE}/lineup/${slug}`,
    };
  }

  async person(username: string): Promise<ShareData> {
    const u = await this.prisma.user.findFirst({ where: { username } });
    if (!u) throw new Error('Person not found');
    return {
      title: u.name || 'Guest',
      description: truncate(stripHtml(u.bio || ''), 200) || DEFAULT_DESCRIPTION,
      image: u.avatarUrl || DEFAULT_IMAGE,
      url: `${SITE}/u/${username}`,
    };
  }
}
