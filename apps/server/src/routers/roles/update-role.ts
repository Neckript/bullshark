import {
  ActivityLogType,
  OWNER_ROLE_ID,
  Permission,
  STORAGE_MAX_QUOTA_PER_USER,
  STORAGE_MIN_QUOTA_PER_USER
} from '@bullshark/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { syncRolePermissions } from '../../db/mutations/roles';
import { publishRole } from '../../db/publishers';
import { rolePermissions, roles } from '../../db/schema';
import { assertOutranksRole } from '../../helpers/assert-rank';
import { enqueueActivityLog } from '../../queues/activity-log';
import { protectedProcedure } from '../../utils/trpc';
import { getUserRoles } from '../users/get-user-roles';

const updateRoleRoute = protectedProcedure
  .input(
    z.object({
      roleId: z.number().min(1),
      name: z.string().min(1).max(26),
      color: z
        .string()
        .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color'),
      hoist: z.boolean(),
      isMentionable: z.boolean(),
      permissions: z.enum(Permission).array(),
      storageQuotaOverrideEnabled: z.boolean(),
      storageSpaceQuota: z
        .number()
        .min(STORAGE_MIN_QUOTA_PER_USER)
        .max(STORAGE_MAX_QUOTA_PER_USER)
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_ROLES);
    await assertOutranksRole(ctx.userId, input.roleId);

    // A MANAGE_ROLES member must not be able to grant permissions they do not
    // themselves hold (privilege escalation): the rank guard above only checks
    // position, not which permissions get written. So restrict the writable
    // set to the permissions the actor actually has - the rest are preserved
    // from the role's current state. The owner bypasses this entirely.
    const actorRoles = await getUserRoles(ctx.userId);
    const actorIsOwner = actorRoles.some((role) => role.id === OWNER_ROLE_ID);
    const actorPermissions = new Set(
      actorRoles.flatMap((role) => role.permissions)
    );

    let permissionsToApply = input.permissions;

    if (!actorIsOwner) {
      const currentPermissions = (
        await db
          .select({ permission: rolePermissions.permission })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, input.roleId))
      ).map((row) => row.permission as Permission);

      const currentSet = new Set(currentPermissions);
      const requestedSet = new Set(input.permissions);

      permissionsToApply = (Object.values(Permission) as Permission[]).filter(
        (permission) =>
          actorPermissions.has(permission)
            ? requestedSet.has(permission)
            : currentSet.has(permission)
      );
    }

    const updatedRole = await db
      .update(roles)
      .set({
        name: input.name,
        color: input.color,
        hoist: input.hoist,
        isMentionable: input.isMentionable,
        storageQuotaOverrideEnabled: input.storageQuotaOverrideEnabled,
        storageSpaceQuota: input.storageSpaceQuota
      })
      .where(eq(roles.id, input.roleId))
      .returning()
      .get();

    if (updatedRole.id !== OWNER_ROLE_ID) {
      await syncRolePermissions(updatedRole.id, permissionsToApply);
    }

    publishRole(updatedRole.id, 'update');
    enqueueActivityLog({
      type: ActivityLogType.UPDATED_ROLE,
      userId: ctx.user.id,
      details: {
        roleId: updatedRole.id,
        permissions: permissionsToApply,
        values: input
      }
    });
  });

export { updateRoleRoute };
