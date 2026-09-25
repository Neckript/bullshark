import { ActivityLogType, Permission } from '@bullshark/shared';
import { eq } from 'drizzle-orm';
import z from 'zod';
import { db } from '../../db';
import { publishUser } from '../../db/publishers';
import { users } from '../../db/schema';
import { assertOutranksUser } from '../../helpers/assert-rank';
import { enqueueActivityLog } from '../../queues/activity-log';
import { protectedProcedure } from '../../utils/trpc';

const removeTimeoutRoute = protectedProcedure
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
        mutedUntil: null,
        mutedBy: null,
        muteReason: null,
        updatedAt: Date.now()
      })
      .where(eq(users.id, input.userId));

    publishUser(input.userId, 'update');

    enqueueActivityLog({
      type: ActivityLogType.USER_TIMEOUT_REMOVED,
      userId: input.userId,
      details: {
        removedBy: ctx.userId
      }
    });
  });

export { removeTimeoutRoute };
