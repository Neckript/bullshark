import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { addPushSubscription } from '../../db/queries/push-subscriptions';
import { assertPublicHttpsUrl } from '../../helpers/assert-safe-endpoint';
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
    // refuse endpoints that target the server's own internal network (SSRF);
    // the authoritative DNS-resolving check runs again at send time
    try {
      assertPublicHttpsUrl(input.endpoint);
    } catch {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid push endpoint.'
      });
    }

    await addPushSubscription({
      userId: ctx.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth
    });
  });

export { subscribeRoute };
