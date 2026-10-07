import { ActivityLogType } from '@bullshark/shared';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { users } from '../../db/schema';
import {
  PASSWORD_MAX_LENGTH,
  zNewPassword
} from '../../helpers/password-policy';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const updatePasswordRoute = protectedProcedure
  .input(
    z.object({
      // currentPassword stays permissive on purpose: it is an existing
      // password being verified, and accounts created under the old rule have
      // shorter ones. Only the two fields being chosen get the new minimum.
      currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
      newPassword: zNewPassword,
      confirmNewPassword: zNewPassword
    })
  )
  .mutation(async ({ ctx, input }) => {
    const user = await db
      .select({
        password: users.password
      })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .get();

    invariant(user, {
      code: 'NOT_FOUND',
      message: 'User not found'
    });

    const currentPasswordValid = await Bun.password.verify(
      input.currentPassword,
      user.password
    );

    if (!currentPasswordValid) {
      ctx.throwValidationError(
        'currentPassword',
        'Current password is incorrect'
      );
    }

    if (input.newPassword !== input.confirmNewPassword) {
      ctx.throwValidationError(
        'confirmNewPassword',
        'New password and confirmation do not match'
      );
    }

    const hashedNewPassword = await Bun.password.hash(input.confirmNewPassword);

    await db
      .update(users)
      .set({
        password: hashedNewPassword,
        // Revokes every token already issued to this user. Changing a password
        // that is only half-trusted is pointless if the sessions opened with
        // the old one keep working.
        tokenVersion: sql`${users.tokenVersion} + 1`
      })
      .where(eq(users.id, ctx.userId))
      .run();

    enqueueActivityLog({
      type: ActivityLogType.USER_UPDATED_PASSWORD,
      userId: ctx.user.id
    });
  });

export { updatePasswordRoute };
