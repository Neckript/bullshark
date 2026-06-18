import { db } from '../../db';
import { isOwner } from '../../db/queries/is-owner';
import { settings } from '../../db/schema';
import { generateOwnerToken, hashOwnerToken } from '../../helpers/owner-token';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const rotateOwnerTokenRoute = protectedProcedure.mutation(async ({ ctx }) => {
  invariant(await isOwner(ctx.userId), {
    code: 'FORBIDDEN',
    message: 'Owner only'
  });

  const token = generateOwnerToken();
  await db
    .update(settings)
    .set({ ownerClaimTokenHash: await hashOwnerToken(token) });

  return { token };
});

export { rotateOwnerTokenRoute };
