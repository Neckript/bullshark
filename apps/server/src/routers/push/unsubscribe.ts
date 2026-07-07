import { z } from 'zod';
import { deletePushSubscriptionsForUser } from '../../db/queries/push-subscriptions';
import { protectedProcedure } from '../../utils/trpc';

const unsubscribeRoute = protectedProcedure
  .input(
    z.object({
      endpoint: z.string().url().max(2048)
    })
  )
  .mutation(async ({ ctx, input }) => {
    await deletePushSubscriptionsForUser(ctx.userId, input.endpoint);
  });

export { unsubscribeRoute };
