import { isAllowedUserSettingKey } from '@sharkord/shared';
import { z } from 'zod';
import { upsertUserSetting } from '../../db/queries/user-settings';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const setRoute = protectedProcedure
  .input(
    z.object({
      key: z.string().min(1).max(100),
      // JSON-serialisable scalar; the persisted preferences are bool today.
      value: z.union([z.boolean(), z.number(), z.string()])
    })
  )
  .mutation(async ({ ctx, input }) => {
    invariant(isAllowedUserSettingKey(input.key), {
      code: 'BAD_REQUEST',
      message: 'Unknown setting key'
    });
    await upsertUserSetting(ctx.userId, input.key, input.value);
  });

export { setRoute };
