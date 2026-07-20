import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

/** Local-disk file storage for KYC documents. Swap for S3/GCS by env var once
 * we're off a single box — callers only depend on save() returning a path/URL. */
@Injectable()
export class StorageService {
  constructor() {
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  save(file: Express.Multer.File): string {
    const ext = (file.originalname.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5);
    const name = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    writeFileSync(join(UPLOAD_DIR, name), file.buffer);
    return `/uploads/${name}`; // served statically in main.ts
  }
}
