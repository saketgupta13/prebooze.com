import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SitemapService } from './sitemap.service';

/** nginx routes prebooze.com/sitemap.xml here (see the /opt/prebooze
 * prebooze-web server block) — same "real backend endpoint, not a static
 * file the SPA's catch-all would otherwise swallow" fix as robots.txt got
 * earlier, just for content that has to be generated rather than served
 * as-is. */
@Controller()
export class SitemapController {
  constructor(private sitemapService: SitemapService) {}

  @Get('sitemap.xml')
  async sitemap(@Res() res: Response) {
    const xml = await this.sitemapService.build();
    res.type('application/xml').send(xml);
  }
}
