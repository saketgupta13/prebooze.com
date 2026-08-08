import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

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

// Raw phone-camera video (teaser reels, event teaser videos) routinely lands
// at 3-6MB+ for a few seconds of footage — fine on a Wi-Fi-connected admin
// uploading it once, brutal for every guest whose homepage then has to fetch
// it. 1280px on the long edge is already well above what a 150px slider
// thumbnail or teaser embed ever displays at; CRF 26 keeps it visually
// close to the source while landing at a few hundred KB-2MB for a short
// clip instead of several MB raw.
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv']);
const VIDEO_MAX_EDGE = 1280;
const VIDEO_CRF = '26';
// Poster only ever needs to cover a ~150px slider thumbnail (2x for retina
// = 300px) — 480px leaves real headroom without shipping a 720px+ image
// for something displayed a fraction of that size.
const POSTER_MAX_WIDTH = 480;

/** Local-disk file storage for uploads. Swap for S3/GCS by env var once
 * we're off a single box — callers only depend on save() returning a path/URL. */
@Injectable()
export class StorageService {
  private readonly log = new Logger('Storage');

  constructor() {
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async save(file: Express.Multer.File): Promise<string> {
    return (await this.saveMedia(file)).url;
  }

  /** Same as save(), plus a generated poster JPEG when the upload is a
   * video — callers that don't need it (the other 8 save() call sites:
   * KYC docs, CVs, logos, ...) are unaffected since save() just discards
   * the extra field. Only MediaController's generic upload (used by admin
   * Reels + organizer teaser videos) actually reads posterUrl. */
  async saveMedia(file: Express.Multer.File): Promise<{ url: string; posterUrl?: string }> {
    const originalExt = (file.originalname.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5);
    const base = process.env.API_PUBLIC_URL || 'https://api.prebooze.com';

    if (VIDEO_EXTENSIONS.has(originalExt)) {
      const { video, poster } = await this.processVideo(file.buffer);
      const videoName = `${Date.now()}-${randomBytes(8).toString('hex')}.mp4`;
      writeFileSync(join(UPLOAD_DIR, videoName), video);
      const url = `${base}/uploads/${videoName}`;
      if (!poster) return { url };
      const posterName = `${Date.now()}-${randomBytes(8).toString('hex')}.jpg`;
      writeFileSync(join(UPLOAD_DIR, posterName), poster);
      return { url, posterUrl: `${base}/uploads/${posterName}` };
    }

    const { buffer, ext } = await this.process(file.buffer, originalExt);
    const name = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    writeFileSync(join(UPLOAD_DIR, name), buffer);
    // Must be absolute: this URL gets embedded in <img>/<video> tags rendered
    // on prebooze-web/prebooze-admin, which are different origins from the
    // API — a relative "/uploads/…" resolves against whichever domain
    // renders it and 404s there (nginx has no /uploads proxy on those sites).
    return { url: `${base}/uploads/${name}` }; // served statically in main.ts
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

  /** Re-encode to web-sized H.264/AAC via the system ffmpeg binary + grab a
   * poster frame. Runs on whatever the upload's actual orientation is (most
   * reels are 9:16, teaser videos can be landscape) — caps whichever side is
   * longer at VIDEO_MAX_EDGE rather than assuming one orientation. Never
   * throws: if ffmpeg isn't installed or a clip is malformed, falls back to
   * the original bytes untouched (same "never make the upload fail over an
   * optimization" stance as image processing above), just with no poster. */
  private async processVideo(buffer: Buffer): Promise<{ video: Buffer; poster?: Buffer }> {
    const stamp = randomBytes(8).toString('hex');
    const inPath = join(tmpdir(), `pb-in-${stamp}`);
    const outPath = join(tmpdir(), `pb-out-${stamp}.mp4`);
    const posterPath = join(tmpdir(), `pb-poster-${stamp}.jpg`);
    try {
      writeFileSync(inPath, buffer);
      const scale = `scale='if(gt(iw,ih),min(${VIDEO_MAX_EDGE},iw),-2)':'if(gt(iw,ih),-2,min(${VIDEO_MAX_EDGE},ih))'`;
      await execFileAsync('ffmpeg', [
        '-y', '-i', inPath,
        '-vf', scale,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', VIDEO_CRF,
        '-c:a', 'aac', '-b:a', '96k',
        '-movflags', '+faststart',
        '-map_metadata', '-1',
        outPath,
      ], { timeout: 120_000 });
      const video = readFileSync(outPath);
      if (video.length >= buffer.length) {
        // Pathological source (already tiny/pre-compressed) — don't make it worse.
        return { video: buffer, poster: await this.extractPoster(inPath, posterPath) };
      }
      const poster = await this.extractPoster(outPath, posterPath);
      return { video, poster };
    } catch (err) {
      this.log.warn(`Video processing skipped, saving original: ${(err as Error).message}`);
      return { video: buffer };
    } finally {
      for (const p of [inPath, outPath, posterPath]) {
        try { unlinkSync(p); } catch { /* may not exist */ }
      }
    }
  }

  private async extractPoster(videoPath: string, posterPath: string): Promise<Buffer | undefined> {
    try {
      await execFileAsync('ffmpeg', [
        '-y', '-ss', '00:00:00.5', '-i', videoPath,
        '-vframes', '1', '-vf', `scale='min(${POSTER_MAX_WIDTH},iw)':-2`,
        '-q:v', '4',
        posterPath,
      ], { timeout: 30_000 });
      return readFileSync(posterPath);
    } catch (err) {
      this.log.warn(`Poster extraction skipped: ${(err as Error).message}`);
      return undefined;
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
