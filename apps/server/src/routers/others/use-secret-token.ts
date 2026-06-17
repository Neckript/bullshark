import { OWNER_ROLE_ID, sha256 } from '@sharkord/shared';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../../db';
import { publishUser } from '../../db/publishers';
import { getSettings } from '../../db/queries/server';
import { userRoles } from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

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
    const settings = await getSettings();

    const matches = await ownerTokenMatches(
      input.token,
      settings.ownerClaimTokenHash
    );

    invariant(matches, {
      code: 'FORBIDDEN',
      message: 'Invalid secret token'
    });

    // Idempotent: a user who is already owner can re-claim (e.g. after rotating
    // the token) without hitting the (user_id, role_id) primary-key conflict.
    await db
      .insert(userRoles)
      .values({
        userId: ctx.userId,
        roleId: OWNER_ROLE_ID,
        createdAt: Date.now()
      })
      .onConflictDoNothing();

    publishUser(ctx.userId, 'update');
  });

export { ownerTokenMatches, useSecretTokenRoute };
