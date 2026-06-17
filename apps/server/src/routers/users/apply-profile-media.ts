import {
  FileSaveType,
  Permission,
  PROFILE_MEDIA_EXTENSIONS
} from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { removeFile } from '../../db/mutations/files';
import { publishUser } from '../../db/publishers';
import { getUserById } from '../../db/queries/users';
import { users } from '../../db/schema';
import { fileManager } from '../../utils/file-manager';
import { invariant } from '../../utils/invariant';
import { isAnimatedImage } from '../../utils/is-animated-image';
import type { Context } from '../../utils/trpc';

type TProfileMediaTarget = 'avatar' | 'banner';

const applyProfileMedia = async (
  ctx: Context,
  target: TProfileMediaTarget,
  fileId: string | undefined
): Promise<void> => {
  const user = await getUserById(ctx.userId);

  invariant(user, { code: 'NOT_FOUND', message: 'User not found' });

  if (fileId) {
    const tempFile = fileManager.getTemporaryFile(fileId);

    invariant(tempFile, {
      code: 'NOT_FOUND',
      message: 'Temporary file not found'
    });

    if (!PROFILE_MEDIA_EXTENSIONS.includes(tempFile.extension)) {
      throw new Error('Invalid file type. Please try again.');
    }

    if (!fileManager.temporaryFileHasMimeType(fileId, 'image/')) {
      throw new Error('Invalid file type. Please try again.');
    }

    if (await isAnimatedImage(tempFile.path)) {
      await ctx.needsPermission(Permission.ANIMATED_AVATAR);
    }
  }

  const currentFileId = target === 'avatar' ? user.avatarId : user.bannerId;

  if (currentFileId) {
    await removeFile(currentFileId);
    await db
      .update(users)
      .set(target === 'avatar' ? { avatarId: null } : { bannerId: null })
      .where(eq(users.id, ctx.userId))
      .run();
  }

  if (fileId) {
    const newFile = await fileManager.saveFile(
      fileId,
      ctx.userId,
      target === 'avatar' ? FileSaveType.AVATAR : FileSaveType.BANNER
    );

    await db
      .update(users)
      .set(
        target === 'avatar'
          ? { avatarId: newFile.id }
          : { bannerId: newFile.id }
      )
      .where(eq(users.id, ctx.userId))
      .run();
  }

  publishUser(ctx.userId, 'update');
};

export { applyProfileMedia, type TProfileMediaTarget };
