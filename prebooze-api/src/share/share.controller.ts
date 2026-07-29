import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ShareService, type ShareData } from './share.service';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderShareHtml(d: ShareData): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(d.title)}</title>
<meta name="description" content="${esc(d.description)}" />
<link rel="canonical" href="${esc(d.url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Prebooze" />
<meta property="og:url" content="${esc(d.url)}" />
<meta property="og:title" content="${esc(d.title)}" />
<meta property="og:description" content="${esc(d.description)}" />
<meta property="og:image" content="${esc(d.image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(d.title)}" />
<meta name="twitter:description" content="${esc(d.description)}" />
<meta name="twitter:image" content="${esc(d.image)}" />
<meta http-equiv="refresh" content="0; url=${esc(d.url)}" />
</head>
<body>
<p><a href="${esc(d.url)}">${esc(d.title)}</a></p>
</body>
</html>`;
}

/** Bot-only — nginx routes known link-unfurl user-agents (WhatsApp,
 * Facebook, Twitter/X, Slack, Telegram, ...) here instead of the SPA for
 * these same six URL shapes; every other visitor never reaches this
 * controller. See ShareService for why this exists at all — bots don't
 * execute JS, so the SPA's client-side per-page meta tags are invisible to
 * them without this. */
@Controller('share')
export class ShareController {
  constructor(private share: ShareService) {}

  @Get('events/:slug')
  async event(@Param('slug') slug: string, @Res() res: Response) {
    const data = await this.share.event(slug).catch(() => this.share.fallback(`/events/${slug}`));
    res.type('html').send(renderShareHtml(data));
  }

  @Get('venues/:id')
  async venue(@Param('id') id: string, @Res() res: Response) {
    const data = await this.share.venue(id).catch(() => this.share.fallback(`/venues/${id}`));
    res.type('html').send(renderShareHtml(data));
  }

  @Get('organizers/:id')
  async organizer(@Param('id') id: string, @Res() res: Response) {
    const data = await this.share.organizer(id).catch(() => this.share.fallback(`/organizers/${id}`));
    res.type('html').send(renderShareHtml(data));
  }

  @Get('promoter/:slug')
  async promoter(@Param('slug') slug: string, @Res() res: Response) {
    const data = await this.share.promoter(slug).catch(() => this.share.fallback(`/promoter/${slug}`));
    res.type('html').send(renderShareHtml(data));
  }

  @Get('lineup/:slug')
  async lineup(@Param('slug') slug: string, @Res() res: Response) {
    const data = await this.share.lineup(slug).catch(() => this.share.fallback(`/lineup/${slug}`));
    res.type('html').send(renderShareHtml(data));
  }

  @Get('u/:username')
  async person(@Param('username') username: string, @Res() res: Response) {
    const data = await this.share.person(username).catch(() => this.share.fallback(`/u/${username}`));
    res.type('html').send(renderShareHtml(data));
  }
}
