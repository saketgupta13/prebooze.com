import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

export type PermissionLevel = 'view' | 'edit' | 'approve';

/** Gate a route on one cell of the permission matrix — see PERM_MODULES in
 * BACKEND.md for the fixed list of module names this must match exactly
 * (they're free-text keys in a JSON blob, not an enum, mirroring
 * prebooze-admin's RoleMatrix). Must run after StaffAuthGuard populates
 * req.staff. */
export const RequirePermission = (module: string, level: PermissionLevel) => SetMetadata(PERMISSION_KEY, { module, level });
