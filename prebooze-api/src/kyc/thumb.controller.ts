import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';

/** Public, unauthenticated by design — same trust level as the static
 * `/uploads/…` route it sits alongside (any poster/logo URL already served
 * from there is public once an event/profile is live). Only ever returns a
 * resized copy of a file StorageService itself already wrote; see
 * StorageService.getThumbnail for the real validation. Grid/list card
 * markup (EventCard, Poster, etc.) never has to change its layout or CSS to
 * use this — only the URL passed into the existing <img> swaps from the
 * full-size original to `/uploads/thumb/:width/:filename`. */
@Controller('uploads/thumb')
export class ThumbController {
  constructor(private storage: StorageService) {}

  @Get(':width/:filename')
  async get(@Param('width', ParseIntPipe) width: number, @Param('filename') filename: string, @Res() res: Response) {
    const path = await this.storage.getThumbnail(filename, width);
    if (!path) {
      // Same original the thumbnail would've been derived from — a guest
      // still sees a correct (just not downsized) image rather than a
      // broken one if a filename/width falls outside the real upload
      // pattern or whitelist.
      return res.redirect(302, `${process.env.API_PUBLIC_URL || 'https://api.prebooze.com'}/uploads/${filename}`);
    }
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(path);
  }
}
