import { Permission } from '@bullshark/shared';
import z from 'zod';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';
import { applyServerBanner } from '../others/apply-server-banner';
import { downloadGif } from './download-gif';

const importToServerBannerRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: 10,
  windowMs: 60_000,
  logLabel: 'gifs.importToServerBanner'
})
  .input(
    z.object({
      gifId: z.string().min(1).max(200)
    })
  )
  .mutation(async ({ ctx, input }) => {
    // applyServerBanner reverifie ce droit ; le controler ici evite en plus
    // qu'un membre sans permission ne declenche un telechargement Klipy.
    await ctx.needsPermission(Permission.MANAGE_SETTINGS);

    const tempFile = await downloadGif(input.gifId, ctx.userId);

    await applyServerBanner(ctx, tempFile.id);
  });

export { importToServerBannerRoute };
