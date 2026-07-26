import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ContentService } from './content.service';

@Controller()
export class ContentController {
  constructor(private content: ContentService) {}

  @Get('banners')
  banners() {
    return this.content.banners();
  }

  @Get('testimonials')
  testimonials(@Query('featured') featured?: string) {
    return this.content.testimonials(featured === 'true');
  }

  @Get('faqs')
  faqs(@Query('audience') audience?: 'guests' | 'organizers') {
    return this.content.faqs(audience);
  }

  @Get('policies')
  policies() {
    return this.content.policies();
  }

  @Get('policies/:slug')
  policy(@Param('slug') slug: string) {
    return this.content.policy(decodeURIComponent(slug));
  }

  @Get('blogs')
  blogs() {
    return this.content.blogs();
  }

  @Get('blogs/:id')
  blog(@Param('id') id: string) {
    return this.content.blog(id);
  }

  @Get('pages/:slug')
  page(@Param('slug') slug: string) {
    return this.content.page(decodeURIComponent(slug));
  }

  @Get('menu')
  menu() {
    return this.content.menu();
  }

  @Get('reels')
  reels() {
    return this.content.reels();
  }

  // No Cache-Control header was set at all, so browsers were free to apply
  // heuristic caching to this frequently-changed, admin-editable endpoint —
  // an admin could save a change and still see stale content afterward.
  // no-store forces a real network fetch every time.
  @Get('settings')
  @Header('Cache-Control', 'no-store')
  settings() {
    return this.content.platformInfo();
  }
}
