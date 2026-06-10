import { Permission } from '@sharkord/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import {
  categoryRolePermissions,
  categoryUserPermissions
} from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const deletePermissionsRoute = protectedProcedure
  .input(
    z
      .object({
        categoryId: z.number(),
        userId: z.number().optional(),
        roleId: z.number().optional()
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
      } else if (input.roleId) {
        await tx
          .delete(categoryRolePermissions)
          .where(
            and(
              eq(categoryRolePermissions.categoryId, input.categoryId),
              eq(categoryRolePermissions.roleId, input.roleId)
            )
          );
      }
    });
  });

export { deletePermissionsRoute };
