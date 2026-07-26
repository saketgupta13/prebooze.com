import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../kyc/storage.service';
import { StaffAuthGuard } from './staff-auth.guard';

// 80MB — comfortably covers a short (few-second) teaser reel; images are a
// few MB at most. Multer buffers the whole file in memory (memoryStorage),
// so this also caps worst-case per-request memory use.
const MAX_UPLOAD_BYTES = 80 * 1024 * 1024;

/** Generic image/video upload for admin content (banners, event posters,
 * gallery photos, teaser reels, category images, ...) — reuses the same
 * local-disk StorageService built for KYC documents. No PermissionGuard:
 * uploading just returns a URL, it doesn't mutate anything by itself — the
 * actual save (PATCH /admin/banners/:id, /admin/events/:id, etc.) is where
 * the real permission check already lives. */
@Controller('admin/media')
@UseGuards(StaffAuthGuard)
export class MediaController {
  constructor(private storage: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required (max 80MB)');
    return { url: this.storage.save(file) };
  }
}
