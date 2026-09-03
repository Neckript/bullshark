import z from 'zod';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';
import { applyProfileMedia } from '../users/apply-profile-media';
import { downloadGif } from './download-gif';

const importToProfileRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: 10,
  windowMs: 60_000,
  logLabel: 'gifs.importToProfile'
})
  .input(
    z.object({
      gifId: z.string().min(1).max(200),
      target: z.enum(['avatar', 'banner'])
    })
  )
  .mutation(async ({ ctx, input }) => {
    const tempFile = await downloadGif(input.gifId, ctx.userId);

    await applyProfileMedia(ctx, input.target, tempFile.id);
  });

export { importToProfileRoute };
