import { getUserSettings } from '../../db/queries/user-settings';
import { protectedProcedure } from '../../utils/trpc';

const getAllRoute = protectedProcedure.query(async ({ ctx }) => {
  return getUserSettings(ctx.userId);
});

export { getAllRoute };
