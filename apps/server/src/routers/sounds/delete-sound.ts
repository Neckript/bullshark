import { ActivityLogType, Permission } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { removeFile } from '../../db/mutations/files';
import { publishSound } from '../../db/publishers';
import { sounds } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const deleteSoundRoute = protectedProcedure
  .input(
    z.object({
      soundId: z.number()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_SOUNDS);

    const removedSound = await db
      .delete(sounds)
      .where(eq(sounds.id, input.soundId))
      .returning()
      .get();

    invariant(removedSound, {
      code: 'NOT_FOUND',
      message: 'Sound not found'
    });

    await removeFile(removedSound.fileId);

    publishSound(removedSound.id, 'delete');
    enqueueActivityLog({
      type: ActivityLogType.DELETED_SOUND,
      userId: ctx.user.id,
      details: {
        name: removedSound.name
      }
    });
  });

export { deleteSoundRoute };
