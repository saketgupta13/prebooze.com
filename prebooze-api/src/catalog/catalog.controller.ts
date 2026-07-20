import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get('events')
  events(@Query() q: { city?: string; cat?: string; sub?: string; search?: string; sort?: string }) {
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

  @Get('organizers')
  organizers(@Query('city') city?: string) {
    return this.catalog.organizers(city);
  }

  @Get('promoters')
  promoters(@Query('city') city?: string) {
    return this.catalog.promoters(city);
  }

  @Get('lineups')
  lineups(@Query('city') city?: string) {
    return this.catalog.lineups(city);
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

  @Get('search')
  search(@Query('q') q: string) {
    return this.catalog.search(q ?? '');
  }

  @Get('search/trending')
  trending() {
    return this.catalog.trending();
  }
}
