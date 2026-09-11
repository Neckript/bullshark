import { OWNER_ROLE_ID, sha256 } from '@bullshark/shared';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../../db';
import { updateSettings } from '../../db/mutations/server';
import { publishUser } from '../../db/publishers';
import { getSettings } from '../../db/queries/server';
import { userRoles } from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';
import { getUserRoles } from '../users/get-user-roles';

// Constant-time comparison of sha256(token) against the stored owner-claim hash.
const ownerTokenMatches = async (
  token: string,
  storedHash: string | null
): Promise<boolean> => {
  if (!storedHash) return false;

  const provided = await sha256(token);

  if (provided.length !== storedHash.length) return false;

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(storedHash));
};

const useSecretTokenRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: 5,
  windowMs: 60_000,
  logLabel: 'useSecretToken'
})
  .input(
    z.object({
      token: z.string()
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Deja proprietaire : il n'y a rien a revendiquer, et exiger un jeton
    // valide ici rendrait un second appel dependant d'un jeton desormais
    // consomme. Sortie muette, comme avant.
    const roles = await getUserRoles(ctx.userId);

    if (roles.some((role) => role.id === OWNER_ROLE_ID)) return;

    const settings = await getSettings();

    const matches = await ownerTokenMatches(
      input.token,
      settings.ownerClaimTokenHash
    );

    invariant(matches, {
      code: 'FORBIDDEN',
      message: 'Invalid secret token'
    });

    await db
      .insert(userRoles)
      .values({
        userId: ctx.userId,
        roleId: OWNER_ROLE_ID,
        createdAt: Date.now()
      })
      .onConflictDoNothing();

    // Consommer le jeton : sans cela il reste valide indefiniment, alors
    // qu'il est affiche au premier demarrage et reste lisible dans les
    // journaux du conteneur. Une rotation explicite en reforge un.
    await updateSettings({ ownerClaimTokenHash: null });

    publishUser(ctx.userId, 'update');
  });

export { ownerTokenMatches, useSecretTokenRoute };
