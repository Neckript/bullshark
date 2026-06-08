import { ActivityLogType, OWNER_ROLE_ID, Permission } from '@sharkord/shared';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '../../db';
import { publishRole } from '../../db/publishers';
import { roles } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { protectedProcedure } from '../../utils/trpc';

const addRoleRoute = protectedProcedure.mutation(async ({ ctx }) => {
  await ctx.needsPermission(Permission.MANAGE_ROLES);

  // New roles enter at the bottom of the hierarchy (just above the default
  // role at position 0): shift every existing custom role up by one, then
  // insert the new role at position 1.
  await db
    .update(roles)
    .set({ position: sql`${roles.position} + 1` })
    .where(and(ne(roles.id, OWNER_ROLE_ID), eq(roles.isDefault, false)));

  const role = await db
    .insert(roles)
    .values({
      name: 'New Role',
      color: '#ffffff',
      position: 1,
      isDefault: false,
      isPersistent: false,
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0,
      createdAt: Date.now()
    })
    .returning()
    .get();

  publishRole(role.id, 'create');
  enqueueActivityLog({
    type: ActivityLogType.CREATED_ROLE,
    userId: ctx.user.id,
    details: {
      roleId: role.id,
      roleName: role.name
    }
  });

  return role.id;
});

export { addRoleRoute };
