import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CareersAdminService } from './careers-admin.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Careers'; // own module as of the expanded-permissions slice

@Controller('admin/careers')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminCareersController {
  constructor(private careers: CareersAdminService) {}

  @Get('jobs')
  @RequirePermission(MODULE, 'view')
  listJobs() {
    return this.careers.listJobs();
  }

  @Post('jobs')
  @RequirePermission(MODULE, 'edit')
  createJob(@Body() body: Parameters<CareersAdminService['createJob']>[0]) {
    return this.careers.createJob(body);
  }

  @Patch('jobs/:id')
  @RequirePermission(MODULE, 'edit')
  updateJob(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.careers.updateJob(id, body);
  }

  @Post('jobs/:id/toggle')
  @RequirePermission(MODULE, 'edit')
  toggleJob(@Param('id') id: string) {
    return this.careers.toggleJob(id);
  }

  @Delete('jobs/:id')
  @RequirePermission(MODULE, 'edit')
  removeJob(@Param('id') id: string) {
    return this.careers.removeJob(id);
  }

  @Get('applicants')
  @RequirePermission(MODULE, 'view')
  listApplicants(@Query('jobId') jobId?: string) {
    return this.careers.listApplicants(jobId);
  }

  @Get('teams')
  @RequirePermission(MODULE, 'view')
  listTeams() {
    return this.careers.listTeams();
  }

  @Post('teams')
  @RequirePermission(MODULE, 'edit')
  addTeam(@Body('name') name: string) {
    return this.careers.addTeam(name);
  }
}
