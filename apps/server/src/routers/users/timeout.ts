import { ActivityLogType, Permission } from '@bullshark/shared';
import { eq } from 'drizzle-orm';
import z from 'zod';
import { db } from '../../db';
import { publishUser } from '../../db/publishers';
import { users } from '../../db/schema';
import { assertOutranksUser } from '../../helpers/assert-rank';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

// Cap the timeout at 28 days, matching Discord's ceiling.
const MAX_TIMEOUT_SECONDS = 28 * 24 * 60 * 60;

const timeoutRoute = protectedProcedure
  .input(
    z.object({
      userId: z.number(),
      durationSeconds: z.number().int().positive().max(MAX_TIMEOUT_SECONDS),
      reason: z.string().optional()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_USERS);

    invariant(input.userId !== ctx.user.id, {
      code: 'BAD_REQUEST',
      message: 'You cannot time yourself out.'
    });

    await assertOutranksUser(ctx.userId, input.userId);

    const mutedUntil = Date.now() + input.durationSeconds * 1000;

    await db
      .update(users)
      .set({
        mutedUntil,
        mutedBy: ctx.userId,
        muteReason: input.reason ?? null,
        updatedAt: Date.now()
      })
      .where(eq(users.id, input.userId));

    publishUser(input.userId, 'update');

    enqueueActivityLog({
      type: ActivityLogType.USER_TIMED_OUT,
      userId: input.userId,
      details: {
        reason: input.reason,
        mutedUntil,
        mutedBy: ctx.userId
      }
    });
  });

export { timeoutRoute };
