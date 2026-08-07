import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service';
import { PERMISSION_KEY, PermissionLevel } from './permission.decorator';
import type { StaffTokenPayload } from './staff-auth.guard';
import { resolvePermissions } from './permissions.util';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<{ module: string; level: PermissionLevel }>(PERMISSION_KEY, ctx.getHandler());
    if (!required) return true; // no @RequirePermission on this route — StaffAuthGuard alone is enough

    const req = ctx.switchToHttp().getRequest();
    const staff: StaffTokenPayload | undefined = req.staff;
    if (!staff) throw new ForbiddenException();

    // Owner always passes — same as the mock's allOn() seed, checked directly
    // rather than trusting a possibly-stale JWT claim about permissions.
    if (staff.roleName === 'Owner') return true;

    const role = await this.prisma.staffRole.findUnique({ where: { name: staff.roleName } });
    const set = role ? resolvePermissions(role)[required.module] : undefined;
    if (!set?.[required.level]) {
      throw new ForbiddenException(`Your role doesn't have "${required.level}" on "${required.module}"`);
    }
    return true;
  }
}
