import { FileSaveType, Permission } from '@bullshark/shared';
import { removeFile } from '../../db/mutations/files';
import { updateSettings } from '../../db/mutations/server';
import { publishSettings } from '../../db/publishers';
import { getSettings } from '../../db/queries/server';
import { fileManager } from '../../utils/file-manager';
import type { Context } from '../../utils/trpc';

// Pendant serveur de applyProfileMedia : meme cycle de vie que le logo
// (removeFile + updateSettings), partage par l'upload et l'import GIF.
// Volontairement sans garde ANIMATED_AVATAR : MANAGE_SETTINGS est deja un
// droit d'administration.
const applyServerBanner = async (
  ctx: Context,
  fileId: string | undefined
): Promise<void> => {
  await ctx.needsPermission(Permission.MANAGE_SETTINGS);

  if (fileId && !fileManager.temporaryFileHasMimeType(fileId, 'image/')) {
    throw new Error('Invalid file type. Please try again.');
  }

  const settings = await getSettings();

  if (settings.bannerId) {
    // Vider la reference AVANT de supprimer la ligne fichier : la contrainte
    // sur banner_id est posee par ALTER TABLE, donc sans ON DELETE set null
    // (SQLite ne sait pas l'ajouter apres coup). L'ordre inverse leve
    // FOREIGN KEY constraint failed.
    await updateSettings({ bannerId: null });
    await removeFile(settings.bannerId);
  }

  if (fileId) {
    const newFile = await fileManager.saveFile(
      fileId,
      ctx.userId,
      FileSaveType.SERVER_BANNER
    );

    await updateSettings({ bannerId: newFile.id });
  }

  publishSettings();
};

export { applyServerBanner };
