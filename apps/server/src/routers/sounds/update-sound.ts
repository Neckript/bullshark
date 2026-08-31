import {
  ActivityLogType,
  MAX_SOUND_NAME_LENGTH,
  Permission
} from '@bullshark/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishSound } from '../../db/publishers';
import { getSoundById, soundExists } from '../../db/queries/sounds';
import { sounds } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const updateSoundRoute = protectedProcedure
  .input(
    z.object({
      soundId: z.number().min(1),
      name: z.string().min(1).max(MAX_SOUND_NAME_LENGTH)
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_SOUNDS);

    const existingSound = await getSoundById(input.soundId);

    invariant(existingSound, {
      code: 'NOT_FOUND',
      message: 'Sound not found'
    });

    const exists = await soundExists(input.name);

    if (exists) {
      ctx.throwValidationError(
        'name',
        'A sound with this name already exists.'
      );
    }

    const updatedSound = await db
      .update(sounds)
      .set({
        name: input.name,
        updatedAt: Date.now()
      })
      .where(eq(sounds.id, existingSound.id))
      .returning()
      .get();

    publishSound(updatedSound.id, 'update');
    enqueueActivityLog({
      type: ActivityLogType.UPDATED_SOUND,
      userId: ctx.user.id,
      details: {
        fromName: existingSound.name,
        toName: input.name
      }
    });
  });

export { updateSoundRoute };
