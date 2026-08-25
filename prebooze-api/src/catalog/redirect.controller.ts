import { Controller, Get, Param, Query, Redirect, NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { toCitySlug } from '../common/city-slug';

// Preserves whatever query string arrived (a review-reminder's ?event=,
// utm params, etc.) across the 301 — this redirect only corrects the
// path's city segment, it isn't meant to drop what the visitor arrived with.
function withQuery(path: string, query: Record<string, string>): string {
  const qs = new URLSearchParams(query).toString();
  return qs ? `${path}?${qs}` : path;
}

/** Real, server-side 301s for the bare/unprefixed entity URL shapes
 * (/events/:slug, /venues/:id, /organizers/:id, /promoter/:slug,
 * /lineup/:slug) to their entity's real city-prefixed canonical —
 * complements EventDetail/VenueDetail/etc's client-side useCityReconcile,
 * which only ever produces a JS-driven redirect (no HTTP Location header,
 * no signal at all to a non-JS-executing client). nginx routes ONLY the
 * bare shape here (for non-bot traffic — bots keep hitting ShareController
 * directly, see share.controller.ts/nginx's $ua_is_bot); an already
 * city-prefixed request never reaches this controller; a wrong-city
 * request (rare — nothing generates one) still falls back to the client-
 * side reconcile. /u/:username is deliberately excluded — never
 * city-prefixed, nothing to redirect. Each lookup 404s the same way the
 * equivalent catalog.* lookup already does for a real guest request (an
 * unapproved event, a deleted venue, etc.), so this never redirects into
 * or reveals anything a bare 404 wouldn't have. */
@Controller('redirect')
export class RedirectController {
  constructor(private catalog: CatalogService) {}

  @Get('events/:slug')
  @Redirect()
  async event(@Param('slug') slug: string, @Query() query: Record<string, string>) {
    const e = await this.catalog.event(slug);
    const city = e.venue?.city ?? e.privateCity;
    // Violates the schema's own "exactly one of venue/privateCity"
    // invariant — shouldn't happen, but a 404 here is safer than
    // redirecting into a malformed //events/slug URL.
    if (!city) throw new NotFoundException('Event not found');
    return { url: withQuery(`/${toCitySlug(city)}/events/${slug}`, query), statusCode: 301 };
  }

  @Get('venues/:id')
  @Redirect()
  async venue(@Param('id') id: string, @Query() query: Record<string, string>) {
    const v = await this.catalog.venue(id);
    return { url: withQuery(`/${toCitySlug(v.city)}/venues/${id}`, query), statusCode: 301 };
  }

  @Get('organizers/:id')
  @Redirect()
  async organizer(@Param('id') id: string, @Query() query: Record<string, string>) {
    const o = await this.catalog.organizer(id);
    return { url: withQuery(`/${toCitySlug(o.city)}/organizers/${id}`, query), statusCode: 301 };
  }

  @Get('promoter/:slug')
  @Redirect()
  async promoter(@Param('slug') slug: string, @Query() query: Record<string, string>) {
    const p = await this.catalog.promoter(slug);
    return { url: withQuery(`/${toCitySlug(p.city)}/promoter/${slug}`, query), statusCode: 301 };
  }

  @Get('lineup/:slug')
  @Redirect()
  async lineup(@Param('slug') slug: string, @Query() query: Record<string, string>) {
    const l = await this.catalog.lineup(slug);
    return { url: withQuery(`/${toCitySlug(l.city)}/lineup/${slug}`, query), statusCode: 301 };
  }
}
