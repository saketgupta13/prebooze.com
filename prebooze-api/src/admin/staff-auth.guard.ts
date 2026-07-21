import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface StaffTokenPayload {
  staffId: string;
  roleName: string;
  email: string; // denormalized into the token for audit-trail fields (reviewedBy etc.) without an extra lookup
}

/** Staff tokens share the same JwtService/secret as guest tokens (see
 * auth/jwt.guard.ts) — kept simple rather than standing up a second signing
 * key. Cross-use is prevented by payload shape instead: this guard requires
 * `staffId`, and the guest JwtAuthGuard now requires `sub`+`phone` — a token
 * issued for one principal type is rejected outright by the other's guard,
 * not silently misread. */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Missing token');
    try {
      const payload = await this.jwt.verifyAsync(token);
      if (!payload.staffId || !payload.roleName) throw new Error('not a staff token');
      req.staff = payload as StaffTokenPayload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
