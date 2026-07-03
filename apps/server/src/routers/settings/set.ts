import { isAllowedUserSettingKey } from '@sharkord/shared';
import { z } from 'zod';
import { upsertUserSetting } from '../../db/queries/user-settings';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

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
    if (input.key.startsWith('custom_theme_')) {
      invariant(
        typeof input.value === 'string' && HEX_COLOR_RE.test(input.value),
        {
          code: 'BAD_REQUEST',
          message: 'Invalid colour value'
        }
      );
    }
    await upsertUserSetting(ctx.userId, input.key, input.value);
  });

export { setRoute };
