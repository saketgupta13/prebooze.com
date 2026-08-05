import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Every real upload (event posters/galleries, venue/organizer/lineup logos,
// guest avatars, KYC documents) used to get written to disk exactly as
// uploaded — a phone-camera photo routinely lands at several MB, which is
// invisible in-app (browsers don't care) but silently breaks WhatsApp/
// Facebook link-preview unfurling, which drops any og:image over ~300KB
// with no error anywhere. 1600px on the long edge is comfortably more than
// this app ever displays an image at; JPEG q82 keeps photos visually
// lossless while landing well under that budget. Real transparency (a logo
// on a transparent background) stays PNG — converting that to JPEG would
// bake in a black/white matte.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

/** Local-disk file storage for uploads. Swap for S3/GCS by env var once
 * we're off a single box — callers only depend on save() returning a path/URL. */
@Injectable()
export class StorageService {
  private readonly log = new Logger('Storage');

  constructor() {
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async save(file: Express.Multer.File): Promise<string> {
    const originalExt = (file.originalname.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5);
    const { buffer, ext } = await this.process(file.buffer, originalExt);
    const name = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    writeFileSync(join(UPLOAD_DIR, name), buffer);
    // Must be absolute: this URL gets embedded in <img>/<video> tags rendered
    // on prebooze-web/prebooze-admin, which are different origins from the
    // API — a relative "/uploads/…" resolves against whichever domain
    // renders it and 404s there (nginx has no /uploads proxy on those sites).
    const base = process.env.API_PUBLIC_URL || 'https://api.prebooze.com';
    return `${base}/uploads/${name}`; // served statically in main.ts
  }

  /** Resize+recompress raster images; anything else (PDF resumes, GIFs,
   * SVGs — animation/vector content sharp would flatten) passes through
   * untouched, same as before this existed. Never throws: a corrupt/
   * unrecognised "image" just falls back to the original bytes rather than
   * failing the whole upload over a thumbnail optimization. */
  private async process(buffer: Buffer, ext: string): Promise<{ buffer: Buffer; ext: string }> {
    if (!IMAGE_EXTENSIONS.has(ext)) return { buffer, ext };
    try {
      const img = sharp(buffer, { failOn: 'none' }).rotate(); // .rotate() with no args: auto-orient from EXIF before it gets stripped
      const meta = await img.metadata();
      const resized = img.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });
      const hasRealAlpha = meta.hasAlpha && (await this.usesTransparency(resized.clone()));
      const out = hasRealAlpha
        ? await resized.png({ compressionLevel: 9 }).toBuffer()
        : await resized.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
      // Pathological input (e.g. incompressible noise) can occasionally
      // re-encode larger than the source — never make the upload worse.
      if (out.length >= buffer.length) return { buffer, ext };
      return { buffer: out, ext: hasRealAlpha ? 'png' : 'jpg' };
    } catch (err) {
      this.log.warn(`Image processing skipped, saving original: ${(err as Error).message}`);
      return { buffer, ext };
    }
  }

  /** hasAlpha is true for any RGBA/LA image even when every pixel is fully
   * opaque (a plain photo re-saved with an alpha channel) — re-encoding
   * that as JPEG is strictly better (smaller, and PNG can't beat JPEG on
   * photos anyway). Only keep PNG when some pixel is actually transparent. */
  private async usesTransparency(pipeline: sharp.Sharp): Promise<boolean> {
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    if (info.channels < 4) return false;
    for (let i = 3; i < data.length; i += info.channels) {
      if (data[i] !== 255) return true;
    }
    return false;
  }
}
