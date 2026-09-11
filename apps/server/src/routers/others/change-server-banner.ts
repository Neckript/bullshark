import z from 'zod';
import { protectedProcedure } from '../../utils/trpc';
import { applyServerBanner } from './apply-server-banner';

const changeServerBannerRoute = protectedProcedure
  .input(z.object({ fileId: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    await applyServerBanner(ctx, input.fileId);
  });

export { changeServerBannerRoute };
