import { FileSaveType, PROFILE_MEDIA_EXTENSIONS } from '@bullshark/shared';
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

  // Enregistrer la nouvelle AVANT de detruire l'ancienne (saveFile leve sur
  // depassement de quota), et vider la reference AVANT de supprimer la ligne
  // fichier : icon_file_id vient d'un ALTER TABLE, donc sans ON DELETE set null
  // (SQLite ne sait pas l'ajouter apres coup). L'ordre inverse leve FOREIGN KEY.
  const newFile = fileId
    ? await fileManager.saveFile(fileId, ctx.userId, FileSaveType.ROLE_ICON)
    : null;

  await db
    .update(roles)
    .set({ iconFileId: newFile?.id ?? null })
    .where(eq(roles.id, roleId))
    .run();

  if (role.iconFileId) {
    await removeFile(role.iconFileId);
  }

  publishRole(roleId, 'update');
};

export { applyRoleIcon };
