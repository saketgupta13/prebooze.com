import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { BroadcastService, BroadcastAudience } from './broadcast.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Push notifications';

type SendBody = { title: string; message: string; audienceType?: 'city' | 'event' | 'follow'; city?: string; eventSlug?: string; followeeKey?: string; scheduledFor?: string };

@Controller('admin/broadcast')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminBroadcastController {
  constructor(private broadcast: BroadcastService) {}

  @Get('audience')
  @RequirePermission(MODULE, 'view')
  audience(@Query('audienceType') audienceType?: string, @Query('city') city?: string, @Query('eventSlug') eventSlug?: string, @Query('followeeKey') followeeKey?: string) {
    const a = this.toAudience({ audienceType, city, eventSlug, followeeKey });
    return this.broadcast.audienceCount(a).then((count) => ({ count }));
  }

  @Get('history')
  @RequirePermission(MODULE, 'view')
  history() {
    return this.broadcast.history();
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  send(@Body() body: SendBody) {
    const a = this.toAudience(body);
    return this.broadcast.send(body.title, body.message, a, body.scheduledFor || undefined);
  }

  private toAudience(q: { audienceType?: string; city?: string; eventSlug?: string; followeeKey?: string }): BroadcastAudience {
    const audienceType = q.audienceType === 'event' || q.audienceType === 'follow' ? q.audienceType : 'city';
    return { audienceType, city: q.city || undefined, eventSlug: q.eventSlug || undefined, followeeKey: q.followeeKey || undefined };
  }
}
