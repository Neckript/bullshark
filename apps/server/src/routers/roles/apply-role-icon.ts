import { FileSaveType, PROFILE_MEDIA_EXTENSIONS } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { removeFile } from '../../db/mutations/files';
import { publishRole } from '../../db/publishers';
import { roles } from '../../db/schema';
import { fileManager } from '../../utils/file-manager';
import { invariant } from '../../utils/invariant';
import type { Context } from '../../utils/trpc';

const applyRoleIcon = async (
  ctx: Context,
  roleId: number,
  fileId: string | undefined
): Promise<void> => {
  const role = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1)
    .get();

  invariant(role, { code: 'NOT_FOUND', message: 'Role not found' });

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
  }

  if (role.iconFileId) {
    await removeFile(role.iconFileId);
    await db
      .update(roles)
      .set({ iconFileId: null })
      .where(eq(roles.id, roleId))
      .run();
  }

  if (fileId) {
    const newFile = await fileManager.saveFile(
      fileId,
      ctx.userId,
      FileSaveType.ROLE_ICON
    );

    await db
      .update(roles)
      .set({ iconFileId: newFile.id })
      .where(eq(roles.id, roleId))
      .run();
  }

  publishRole(roleId, 'update');
};

export { applyRoleIcon };
