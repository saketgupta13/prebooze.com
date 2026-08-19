import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(
    private catalog: CatalogService,
    private jwt: JwtService,
  ) {}

  @Get('events')
  events(@Query() q: { city?: string; cat?: string; sub?: string; search?: string; sort?: string; organizerId?: string; venueId?: string; includePast?: string }) {
    return this.catalog.events({ ...q, includePast: q.includePast === 'true' });
  }

  /** `preview` is a short-lived, event-scoped token issued by
   * OrganizerService.adminPreviewLink (Admin > Events > "Preview") — decoded
   * here rather than behind a guard, same "public route, an optional token
   * just relaxes what it returns" shape as people()/person() below. An
   * invalid/expired/wrong-event token just falls back to the normal
   * approved-only visibility, never widens it further than that one event. */
  @Get('events/:slug')
  async event(@Param('slug') slug: string, @Query('preview') preview?: string) {
    let previewEventId: string | undefined;
    if (preview) {
      try {
        const payload = await this.jwt.verifyAsync(preview);
        if (payload.purpose === 'event-preview' && payload.eventId) previewEventId = payload.eventId;
      } catch {
        // invalid/expired preview token — falls back to approved-only
      }
    }
    return this.catalog.event(slug, previewEventId);
  }

  @Get('venues')
  venues(@Query('city') city?: string) {
    return this.catalog.venues(city);
  }

  @Get('venues/:id/seo')
  venueSeo(@Param('id') id: string) {
    return this.catalog.venueSeo(id);
  }

  @Get('venues/:id')
  venue(@Param('id') id: string) {
    return this.catalog.venue(id);
  }

  @Get('organizers')
  organizers(@Query('city') city?: string) {
    return this.catalog.organizers(city);
  }

  @Get('organizers/:id/seo')
  organizerSeo(@Param('id') id: string) {
    return this.catalog.organizerSeo(id);
  }

  @Get('organizers/:id')
  organizer(@Param('id') id: string) {
    return this.catalog.organizer(id);
  }

  @Get('promoters')
  promoters(@Query('city') city?: string) {
    return this.catalog.promoters(city);
  }

  @Get('promoters/:id/seo')
  promoterSeo(@Param('id') id: string) {
    return this.catalog.promoterSeo(id);
  }

  @Get('promoters/:slug')
  promoter(@Param('slug') slug: string) {
    return this.catalog.promoter(slug);
  }

  @Get('lineups')
  lineups(@Query('city') city?: string) {
    return this.catalog.lineups(city);
  }

  @Get('lineups/:id/seo')
  lineupSeo(@Param('id') id: string) {
    return this.catalog.lineupSeo(id);
  }

  @Get('lineups/:slug')
  lineup(@Param('slug') slug: string) {
    return this.catalog.lineup(slug);
  }

  @Get('people')
  async people(@Query('city') city: string | undefined, @Req() req: { headers: { authorization?: string } }) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    let viewerId: string | undefined;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync(token);
        if (payload.sub && payload.phone) viewerId = payload.sub;
      } catch {
        // not logged in / expired — fine, just means no viewer-relative gating
      }
    }
    return this.catalog.people(city, viewerId);
  }

  /** Public, but personalized if a valid guest token happens to be present
   * (JwtAuthGuard would reject the request outright for a logged-out
   * visitor, which this route needs to support) — decoded manually so a
   * missing/expired token just means "viewing as a stranger" instead of a
   * 401. Only affects whether the "going"/"interested" section is visible
   * per the target's attendanceVisibility; everything else is public either way. */
  @Get('people/:username')
  async person(@Param('username') username: string, @Req() req: { headers: { authorization?: string } }) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    let viewerId: string | undefined;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync(token);
        if (payload.sub && payload.phone) viewerId = payload.sub;
      } catch {
        // not logged in / expired — fine, just means no viewer-relative gating
      }
    }
    return this.catalog.person(username, viewerId);
  }

  @Get('featured')
  featured(@Query('city') city?: string) {
    return this.catalog.featured(city);
  }

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('cities')
  cities() {
    return this.catalog.cities();
  }

  @Get('venue-types')
  venueTypes() {
    return this.catalog.venueTypes();
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.catalog.search(q ?? '');
  }

  @Get('search/trending')
  trending() {
    return this.catalog.trending();
  }
}
