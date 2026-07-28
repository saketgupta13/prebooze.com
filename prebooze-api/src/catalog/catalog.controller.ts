import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get('events')
  events(@Query() q: { city?: string; cat?: string; sub?: string; search?: string; sort?: string; organizerId?: string; venueId?: string }) {
    return this.catalog.events(q);
  }

  @Get('events/:slug')
  event(@Param('slug') slug: string) {
    return this.catalog.event(slug);
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
  people(@Query('city') city?: string) {
    return this.catalog.people(city);
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
