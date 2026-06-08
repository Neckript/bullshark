import z from 'zod';
import { protectedProcedure } from '../../utils/trpc';
import { applyProfileMedia } from './apply-profile-media';

const changeAvatarRoute = protectedProcedure
  .input(z.object({ fileId: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    await applyProfileMedia(ctx, 'avatar', input.fileId);
  });

export { changeAvatarRoute };
