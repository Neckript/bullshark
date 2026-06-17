import { ChannelPermission, Permission } from '@sharkord/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishChannelPermissions } from '../../db/publishers';
import { getAffectedOnlineUserIdsForCategoryTarget } from '../../db/queries/channels';
import {
  categoryRolePermissions,
  categoryUserPermissions
} from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const allPermissions = Object.values(ChannelPermission);

const updatePermissionsRoute = protectedProcedure
  .input(
    z
      .object({
        categoryId: z.number(),
        userId: z.number().optional(),
        roleId: z.number().optional(),
        isCreate: z.boolean().optional().default(false),
        permissions: z.array(z.enum(ChannelPermission)).default([])
      })
      .refine((data) => !!(data.userId || data.roleId), {
        message: 'Either userId or roleId must be provided'
      })
      .refine((data) => !(data.userId && data.roleId), {
        message: 'Cannot specify both userId and roleId'
      })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_CHANNEL_PERMISSIONS);

    const permissions = input.isCreate ? [] : input.permissions;

    await db.transaction(async (tx) => {
      if (input.userId) {
        await tx
          .delete(categoryUserPermissions)
          .where(
            and(
              eq(categoryUserPermissions.categoryId, input.categoryId),
              eq(categoryUserPermissions.userId, input.userId)
            )
          );

        const values = allPermissions.map((perm) => ({
          categoryId: input.categoryId,
          userId: input.userId!,
          permission: perm,
          allow: permissions.includes(perm),
          createdAt: Date.now()
        }));

        await tx.insert(categoryUserPermissions).values(values);
      } else if (input.roleId) {
        await tx
          .delete(categoryRolePermissions)
          .where(
            and(
              eq(categoryRolePermissions.categoryId, input.categoryId),
              eq(categoryRolePermissions.roleId, input.roleId)
            )
          );

        const values = allPermissions.map((perm) => ({
          categoryId: input.categoryId,
          roleId: input.roleId!,
          permission: perm,
          allow: permissions.includes(perm),
          createdAt: Date.now()
        }));

        await tx.insert(categoryRolePermissions).values(values);
      }
    });

    const affectedUserIds = await getAffectedOnlineUserIdsForCategoryTarget({
      userId: input.userId,
      roleId: input.roleId
    });

    publishChannelPermissions(affectedUserIds);
  });

export { updatePermissionsRoute };
