import { ActivityLogType, Permission } from '@bullshark/shared';
import { eq } from 'drizzle-orm';
import z from 'zod';
import { db } from '../../db';
import { publishUser } from '../../db/publishers';
import { users } from '../../db/schema';
import { assertOutranksUser } from '../../helpers/assert-rank';
import { enqueueActivityLog } from '../../queues/activity-log';
import { protectedProcedure } from '../../utils/trpc';

const unbanRoute = protectedProcedure
  .input(
    z.object({
      userId: z.number()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_USERS);
    await assertOutranksUser(ctx.userId, input.userId);

    await db
      .update(users)
      .set({
        banned: false,
        banReason: null,
        bannedAt: null
      })
      .where(eq(users.id, input.userId));

    publishUser(input.userId, 'update');

    enqueueActivityLog({
      type: ActivityLogType.USER_UNBANNED,
      userId: input.userId,
      details: {
        unbannedBy: ctx.userId
      }
    });
  });

export { unbanRoute };
