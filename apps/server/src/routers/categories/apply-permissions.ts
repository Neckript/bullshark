import { Permission } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishChannelPermissions } from '../../db/publishers';
import { copyCategoryPermissionsToChannel } from '../../db/queries/categories';
import { getAffectedOnlineUserIdsForChannel } from '../../db/queries/channels';
import { channels } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const applyPermissionsRoute = protectedProcedure
  .input(z.object({ categoryId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_CHANNEL_PERMISSIONS);

    const childChannels = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.categoryId, input.categoryId));

    await db.transaction(async (tx) => {
      for (const channel of childChannels) {
        await copyCategoryPermissionsToChannel(tx, input.categoryId, channel.id);
      }
    });

    const affected = new Set<number>();
    for (const channel of childChannels) {
      const ids = await getAffectedOnlineUserIdsForChannel(channel.id);
      ids.forEach((id) => affected.add(id));
    }

    publishChannelPermissions(Array.from(affected));
  });

export { applyPermissionsRoute };
