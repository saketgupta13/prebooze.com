import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { StaffTokenPayload } from './staff-auth.guard';

/** Staff & role management isn't part of the delegatable permission matrix
 * at all — it's not even one of PERM_MODULES in prebooze-admin's
 * RoleMatrix — for the obvious reason that letting a role grant itself more
 * permissions via the matrix it's editing would be a privilege-escalation
 * hole. Owner only, hardcoded. Must run after StaffAuthGuard. */
@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const staff: StaffTokenPayload | undefined = req.staff;
    if (staff?.roleName !== 'Owner') throw new ForbiddenException('Owner only');
    return true;
  }
}
