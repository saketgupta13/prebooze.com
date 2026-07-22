import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../kyc/storage.service';
import { StaffAuthGuard } from './staff-auth.guard';

/** Generic image upload for admin content (banners, event posters, category
 * images, ...) — reuses the same local-disk StorageService built for KYC
 * documents. No PermissionGuard: uploading just returns a URL, it doesn't
 * mutate anything by itself — the actual save (PATCH /admin/banners/:id
 * etc.) is where the real permission check already lives. */
@Controller('admin/media')
@UseGuards(StaffAuthGuard)
export class MediaController {
  constructor(private storage: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    return { url: this.storage.save(file) };
  }
}
