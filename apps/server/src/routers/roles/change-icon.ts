import { OWNER_ROLE_ID, Permission } from '@sharkord/shared';
import { z } from 'zod';
import { assertOutranksRole } from '../../helpers/assert-rank';
import { protectedProcedure } from '../../utils/trpc';
import { applyRoleIcon } from './apply-role-icon';

const changeIconRoute = protectedProcedure
  .input(z.object({ roleId: z.number().min(1), fileId: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_ROLES);

    if (input.roleId !== OWNER_ROLE_ID) {
      await assertOutranksRole(ctx.userId, input.roleId);
    }

    await applyRoleIcon(ctx, input.roleId, input.fileId);
  });

export { changeIconRoute };
