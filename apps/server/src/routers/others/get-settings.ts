import { Permission } from '@bullshark/shared';
import { getSettings } from '../../db/queries/server';
import { clearFields } from '../../helpers/clear-fields';
import { signFile } from '../../helpers/files-crypto';
import { protectedProcedure } from '../../utils/trpc';

const getSettingsRoute = protectedProcedure.query(async ({ ctx }) => {
  await ctx.needsPermission(Permission.MANAGE_SETTINGS);

  const settings = await getSettings();

  return clearFields(
    {
      ...settings,
      // Le logo est exempte du regime d'URL signee (il s'affiche avant
      // connexion), la banniere non : sans jeton, son apercu dans l'ecran
      // d'administration prend un 403 des que les URL signees sont actives.
      banner: signFile(
        settings.banner,
        settings.storageSignedUrlsEnabled,
        settings.storageSignedUrlsTtlSeconds
      )
    },
    ['password', 'secretToken', 'klipyApiKey', 'ownerClaimTokenHash']
  );
});

export { getSettingsRoute };
