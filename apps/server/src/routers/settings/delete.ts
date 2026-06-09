import { isAllowedUserSettingKey } from '@sharkord/shared';
import { z } from 'zod';
import { deleteUserSetting } from '../../db/queries/user-settings';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const deleteRoute = protectedProcedure
  .input(z.object({ key: z.string().min(1).max(100) }))
  .mutation(async ({ ctx, input }) => {
    invariant(isAllowedUserSettingKey(input.key), {
      code: 'BAD_REQUEST',
      message: 'Unknown setting key'
    });
    await deleteUserSetting(ctx.userId, input.key);
  });

export { deleteRoute };
