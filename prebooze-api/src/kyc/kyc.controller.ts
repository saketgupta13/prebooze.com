import {
  Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors,
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

@Controller('admin/kyc')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminKycController {
  constructor(private kyc: KycService) {}

  @Get()
  @RequirePermission('Verifications (KYC)', 'view')
  list(@Query('status') status?: string) {
    return this.kyc.listForAdmin(status);
  }

  @Post(':id/approve')
  @RequirePermission('Verifications (KYC)', 'approve')
  approve(@Param('id') id: string, @Req() req: { staff: StaffTokenPayload }) {
    return this.kyc.approve(id, req.staff.email);
  }

  /** Lead team only — "Start Onboarding" on a lead. Gated on Leads
   * permission rather than Verifications, since this is the lead team's own
   * action (it just happens to create a KycSubmission under the hood); the
   * resulting application still only becomes approvable by whoever holds
   * Verifications permission, via addVerificationDetails/addDocuments/
   * approve above. */
  @Post('organizer/from-lead/:leadId')
  @RequirePermission('Leads', 'edit')
  startOrganizerOnboarding(
    @Param('leadId') leadId: string,
    @Body()
    body: {
      brandName?: string; contactPerson?: string;
      city?: string; state?: string; country?: string; pincode?: string;
      eventTypes?: string; about?: string;
      socialLinks?: { instagram?: string; facebook?: string; other?: string[] };
      confirmExistingUser?: boolean;
    },
    @Req() req: { staff: StaffTokenPayload },
  ) {
    return this.kyc.startOrganizerOnboarding(leadId, req.staff.email, body);
  }

  @Post(':id/reject')
  @RequirePermission('Verifications (KYC)', 'approve')
  reject(@Param('id') id: string, @Body('reason') reason: string, @Req() req: { staff: StaffTokenPayload }) {
    return this.kyc.reject(id, req.staff.email, reason ?? '');
  }

  /** Verification team only — GSTIN/PAN/bank details, collected once they've
   * called the applicant themselves. Lives here (permission-gated to
   * Verifications, not Leads) even though it's reached from a Leads-started
   * application, since only the verification team ever fills this in. */
  @Patch(':id/verification-details')
  @RequirePermission('Verifications (KYC)', 'edit')
  addVerificationDetails(
    @Param('id') id: string,
    @Body() body: { gstin?: string; pan?: string; bankName?: string; bankAccount?: string; accountHolderName?: string; bankIfsc?: string },
  ) {
    return this.kyc.addOrganizerVerificationDetails(id, body);
  }

  /** Body's documents are already-uploaded URLs (POST /admin/media/upload),
   * not raw files — see addOrganizerDocuments's doc comment. */
  @Post(':id/documents')
  @RequirePermission('Verifications (KYC)', 'edit')
  addDocuments(@Param('id') id: string, @Body('documents') documents: { type: string; path: string }[]) {
    return this.kyc.addOrganizerDocuments(id, documents ?? []);
  }
}
