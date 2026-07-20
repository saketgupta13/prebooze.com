import {
  Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from './admin.guard';

@Controller('kyc')
export class KycController {
  constructor(private kyc: KycService) {}

  /** Guest — automatic. Two files: idDoc + selfie. */
  @Post('guest')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'idDoc', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]))
  submitGuest(
    @Req() req: { user: { sub: string } },
    @UploadedFiles() files: { idDoc?: Express.Multer.File[]; selfie?: Express.Multer.File[] },
  ) {
    return this.kyc.submitGuest(req.user.sub, files.idDoc?.[0], files.selfie?.[0]);
  }

  /** Organizer/promoter/lineup/venue — always manual review. */
  @Post('role')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('documents', 6))
  submitRole(
    @Req() req: { user: { sub: string } },
    @Body('kind') kind: string,
    @Body('payload') payloadRaw: string,
    @UploadedFiles() documents: Express.Multer.File[],
  ) {
    const payload = payloadRaw ? JSON.parse(payloadRaw) : {};
    return this.kyc.submitRole(req.user.sub, kind as 'organizer', payload, documents ?? []);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { sub: string } }) {
    return this.kyc.myStatus(req.user.sub);
  }
}

@Controller('admin/kyc')
@UseGuards(AdminGuard)
export class AdminKycController {
  constructor(private kyc: KycService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.kyc.listForAdmin(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: { headers: Record<string, string> }) {
    return this.kyc.approve(id, req.headers['x-admin-user'] ?? 'admin');
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: { headers: Record<string, string> },
  ) {
    return this.kyc.reject(id, req.headers['x-admin-user'] ?? 'admin', reason ?? '');
  }
}
