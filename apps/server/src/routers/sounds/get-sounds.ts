import { Permission } from '@sharkord/shared';
import { getSounds } from '../../db/queries/sounds';
import { protectedProcedure } from '../../utils/trpc';

const getSoundsRoute = protectedProcedure.query(async ({ ctx }) => {
  await ctx.needsPermission(Permission.MANAGE_SOUNDS);

  const sounds = await getSounds();

  return sounds;
});

export { getSoundsRoute };
