import z from 'zod';
import { protectedProcedure } from '../../utils/trpc';
import { applyProfileMedia } from './apply-profile-media';

const changeBannerRoute = protectedProcedure
  .input(z.object({ fileId: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    await applyProfileMedia(ctx, 'banner', input.fileId);
  });

export { changeBannerRoute };
