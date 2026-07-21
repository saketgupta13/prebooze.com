import {
  Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard, StaffTokenPayload } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

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

// KYC approvals grant elevated roles, which is squarely a "who's allowed to
// do business as an organizer/promoter/etc on this platform" decision — the
// closest fit in PERM_MODULES is "Customers & organizers", not a dedicated
// module of its own (the mock's RoleMatrix never modeled a KYC-specific
// permission). See BACKEND.md "Admin API".
@Controller('admin/kyc')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminKycController {
  constructor(private kyc: KycService) {}

  @Get()
  @RequirePermission('Customers & organizers', 'view')
  list(@Query('status') status?: string) {
    return this.kyc.listForAdmin(status);
  }

  @Post(':id/approve')
  @RequirePermission('Customers & organizers', 'approve')
  approve(@Param('id') id: string, @Req() req: { staff: StaffTokenPayload }) {
    return this.kyc.approve(id, req.staff.email);
  }

  @Post(':id/reject')
  @RequirePermission('Customers & organizers', 'approve')
  reject(@Param('id') id: string, @Body('reason') reason: string, @Req() req: { staff: StaffTokenPayload }) {
    return this.kyc.reject(id, req.staff.email, reason ?? '');
  }
}
