import { Permission } from '@sharkord/shared';
import { z } from 'zod';
import { getCategoryPermissions } from '../../db/queries/categories';
import { protectedProcedure } from '../../utils/trpc';

const getPermissionsRoute = protectedProcedure
  .input(
    z.object({
      categoryId: z.number()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_CHANNEL_PERMISSIONS);

    return getCategoryPermissions(input.categoryId);
  });

export { getPermissionsRoute };
