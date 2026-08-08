import {
  ActivityLogType,
  FileSaveType,
  MAX_SOUND_FILE_SIZE,
  MAX_SOUND_NAME_LENGTH,
  MAX_SOUNDS_PER_SERVER,
  Permission
} from '@sharkord/shared';
import { z } from 'zod';
import { config } from '../../config';
import { db } from '../../db';
import { publishSound } from '../../db/publishers';
import { countSounds, getUniqueSoundName } from '../../db/queries/sounds';
import { sounds } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { fileManager } from '../../utils/file-manager';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const addSoundRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.addSound.maxRequests,
  windowMs: config.rateLimiters.addSound.windowMs,
  logLabel: 'addSound'
})
  .input(
    z.array(
      z.object({
        fileId: z.string(),
        name: z.string().min(1).max(MAX_SOUND_NAME_LENGTH)
      })
    )
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_SOUNDS);

    for (const data of input) {
      const temporaryFile = fileManager.getTemporaryFile(data.fileId);

      invariant(temporaryFile, {
        code: 'NOT_FOUND',
        message: 'Uploaded file not found'
      });

      invariant(fileManager.temporaryFileHasMimeType(data.fileId, 'audio/'), {
        code: 'BAD_REQUEST',
        message: 'Only audio files are allowed'
      });

      invariant(temporaryFile.size <= MAX_SOUND_FILE_SIZE, {
        code: 'BAD_REQUEST',
        message: 'Sound file is too large'
      });

      invariant((await countSounds()) < MAX_SOUNDS_PER_SERVER, {
        code: 'BAD_REQUEST',
        message: 'This server has reached its sound limit'
      });

      const newFile = await fileManager.saveFile(
        data.fileId,
        ctx.userId,
        FileSaveType.SOUND
      );

      const uniqueSoundName = await getUniqueSoundName(data.name);

      const sound = db
        .insert(sounds)
        .values({
          name: uniqueSoundName,
          fileId: newFile.id,
          userId: ctx.userId,
          createdAt: Date.now()
        })
        .returning()
        .get();

      publishSound(sound.id, 'create');
      enqueueActivityLog({
        type: ActivityLogType.CREATED_SOUND,
        userId: ctx.user.id,
        details: {
          name: sound.name
        }
      });
    }
  });

export { addSoundRoute };
