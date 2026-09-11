import {
  FileSaveType,
  Permission,
  PROFILE_MEDIA_EXTENSIONS
} from '@bullshark/shared';
import { removeFile } from '../../db/mutations/files';
import { updateSettings } from '../../db/mutations/server';
import { publishSettings } from '../../db/publishers';
import { getSettings } from '../../db/queries/server';
import { fileManager } from '../../utils/file-manager';
import { invariant } from '../../utils/invariant';
import type { Context } from '../../utils/trpc';

// Pendant serveur de applyProfileMedia, partage par l'upload et l'import GIF.
// Volontairement sans garde ANIMATED_AVATAR : MANAGE_SETTINGS est deja un
// droit d'administration.
const applyServerBanner = async (
  ctx: Context,
  fileId: string | undefined
): Promise<void> => {
  await ctx.needsPermission(Permission.MANAGE_SETTINGS);

  if (fileId) {
    const tempFile = fileManager.getTemporaryFile(fileId);

    invariant(tempFile, {
      code: 'NOT_FOUND',
      message: 'Temporary file not found'
    });

    // Le filtre du selecteur de fichiers n'est qu'une suggestion : sans cette
    // liste, un .bmp passe et la sidebar affiche un bloc vide sans erreur.
    if (
      !PROFILE_MEDIA_EXTENSIONS.includes(tempFile.extension) ||
      !fileManager.temporaryFileHasMimeType(fileId, 'image/')
    ) {
      throw new Error('Invalid file type. Please try again.');
    }
  }

  const { bannerId: previousBannerId } = await getSettings();

  // Enregistrer la nouvelle AVANT de detruire l'ancienne : saveFile leve sur
  // un depassement de quota, et l'ordre inverse laissait le serveur sans
  // banniere du tout.
  const newFile = fileId
    ? await fileManager.saveFile(fileId, ctx.userId, FileSaveType.SERVER_BANNER)
    : null;

  // Vider la reference avant de supprimer la ligne fichier : la contrainte sur
  // banner_id est posee par ALTER TABLE, donc sans ON DELETE set null (SQLite
  // ne sait pas l'ajouter apres coup). L'ordre inverse leve FOREIGN KEY.
  await updateSettings({ bannerId: newFile?.id ?? null });

  if (previousBannerId) {
    await removeFile(previousBannerId);
  }

  publishSettings();
};

export { applyServerBanner };
