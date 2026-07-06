import { z } from 'zod';
import { addPushSubscription } from '../../db/queries/push-subscriptions';
import { protectedProcedure } from '../../utils/trpc';

const subscribeRoute = protectedProcedure
  .input(
    z.object({
      endpoint: z.string().url().max(2048),
      p256dh: z.string().min(1).max(512),
      auth: z.string().min(1).max(512)
    })
  )
  .mutation(async ({ ctx, input }) => {
    await addPushSubscription({
      userId: ctx.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth
    });
  });

export { subscribeRoute };
