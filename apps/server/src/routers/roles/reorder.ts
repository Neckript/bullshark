import {
  OWNER_ROLE_ID,
  OWNER_ROLE_POSITION,
  Permission
} from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishRole } from '../../db/publishers';
import { getUserTopPosition } from '../../db/queries/roles';
import { roles } from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const reorderRoute = protectedProcedure
  .input(
    z.object({
      // movable roles only, ordered top (highest rank) -> bottom
      orderedRoleIds: z.number().array()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_ROLES);

    const allRoles = await db.select().from(roles);
    const movable = allRoles.filter(
      (r) => r.id !== OWNER_ROLE_ID && !r.isDefault
    );

    // input must be exactly the set of movable roles, with no duplicates
    const movableIds = new Set(movable.map((r) => r.id));
    invariant(
      input.orderedRoleIds.length === movableIds.size &&
        new Set(input.orderedRoleIds).size === input.orderedRoleIds.length &&
        input.orderedRoleIds.every((id) => movableIds.has(id)),
      { code: 'BAD_REQUEST', message: 'Invalid role ordering' }
    );

    const actorTop = await getUserTopPosition(ctx.userId);
    const isOwner = actorTop === OWNER_ROLE_POSITION;

    // input is top-first; reverse so the bottom role gets the lowest position.
    const bottomToTop = [...input.orderedRoleIds].reverse();

    if (!isOwner) {
      for (let i = 0; i < bottomToTop.length; i++) {
        const roleId = bottomToTop[i]!;
        const newPosition = i + 1;
        const current = movable.find((r) => r.id === roleId)!;

        invariant(actorTop > current.position && actorTop > newPosition, {
          code: 'FORBIDDEN',
          message: 'You cannot reorder roles at or above your own rank'
        });
      }
    }

    for (let i = 0; i < bottomToTop.length; i++) {
      await db
        .update(roles)
        .set({ position: i + 1, updatedAt: Date.now() })
        .where(eq(roles.id, bottomToTop[i]!));
    }

    for (const roleId of input.orderedRoleIds) {
      publishRole(roleId, 'update');
    }
  });

export { reorderRoute };
