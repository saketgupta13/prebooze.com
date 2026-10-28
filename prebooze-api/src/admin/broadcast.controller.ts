import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Push notifications';

@Controller('admin/broadcast')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminBroadcastController {
  constructor(private broadcast: BroadcastService) {}

  /** Live "this many guests will get it" preview as the admin types a city
   * filter, before committing to a real send — the send itself can't be
   * undone once it's gone out. */
  @Get('audience')
  @RequirePermission(MODULE, 'view')
  audience(@Query('city') city?: string) {
    return this.broadcast.audienceCount(city || undefined).then((count) => ({ count }));
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  send(@Body() body: { title: string; message: string; city?: string; eventSlug?: string }) {
    return this.broadcast.send(body.title, body.message, body.city || undefined, body.eventSlug || undefined);
  }
}
