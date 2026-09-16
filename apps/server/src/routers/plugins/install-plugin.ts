import { Permission, zPluginId } from '@bullshark/shared';
import z from 'zod';
import { downloadPlugin } from '../../helpers/downloads';
import { fetchMarketplaceVersion } from '../../helpers/marketplace';
import { pluginManager } from '../../plugins';
import { protectedProcedure } from '../../utils/trpc';

const installRoute = protectedProcedure
  .input(
    z.object({
      pluginId: zPluginId,
      version: z.string().min(1)
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_PLUGINS);

    const versionData = await fetchMarketplaceVersion(
      input.pluginId,
      input.version
    );

    const wasEnabled = pluginManager.isEnabled(input.pluginId);

    if (wasEnabled) {
      await pluginManager.unload(input.pluginId);
    }

    const signatureStatus = await downloadPlugin(
      versionData.downloadUrl,
      versionData.checksum,
      versionData.signature
    );

    if (wasEnabled) {
      await pluginManager.load(input.pluginId);
    }

    return { signatureStatus };
  });

export { installRoute };
