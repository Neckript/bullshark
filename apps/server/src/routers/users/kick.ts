import { ActivityLogType, DisconnectCode, Permission } from '@bullshark/shared';
import z from 'zod';
import { assertOutranksUser } from '../../helpers/assert-rank';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const kickRoute = protectedProcedure
  .input(
    z.object({
      userId: z.number(),
      reason: z.string().optional()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_USERS);

    await assertOutranksUser(ctx.userId, input.userId);

    const closedSockets = ctx.disconnectUser(
      input.userId,
      DisconnectCode.KICKED,
      input.reason
    );

    invariant(closedSockets > 0, {
      code: 'NOT_FOUND',
      message: 'User is not connected'
    });

    enqueueActivityLog({
      type: ActivityLogType.USER_KICKED,
      userId: input.userId,
      details: {
        reason: input.reason,
        kickedBy: ctx.userId
      }
    });
  });

export { kickRoute };
