import { BadRequestException, Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CareersService } from './careers.service';

const CV_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

@Controller('careers')
export class CareersController {
  constructor(private careers: CareersService) {}

  @Get('jobs')
  jobs() {
    return this.careers.jobs();
  }

  /** Public, unauthenticated — matches the frontend's plain name/email/phone
   * form. The optional CV file rides in this same multipart request rather
   * than a separate freestanding upload endpoint: this app has no anonymous
   * upload route anywhere else, and bundling it here means a stored file is
   * always the side effect of a real, validated JobApplication row, not
   * free-standing anonymous storage. */
  @Post('apply')
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: 5 * 1024 * 1024 } }))
  apply(@Body() body: Omit<Parameters<CareersService['apply']>[0], 'cv'>, @UploadedFile() file?: Express.Multer.File) {
    if (file && !CV_TYPES.has(file.mimetype)) throw new BadRequestException('CV must be a PDF or Word document');
    return this.careers.apply(body, file);
  }
}
