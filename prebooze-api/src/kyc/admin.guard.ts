import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/** Placeholder admin gate — a shared secret header — until real staff/admin
 * auth ships with the admin-panel API phase (see BACKEND.md). Every admin
 * KYC action still records who approved/rejected it in reviewedBy. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const secret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_API_SECRET || secret !== process.env.ADMIN_API_SECRET) {
      throw new UnauthorizedException('Invalid admin credentials');
    }
    return true;
  }
}
