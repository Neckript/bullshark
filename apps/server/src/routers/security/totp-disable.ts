import { ActivityLogType } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { disableTotp } from '../../db/mutations/totp';
import { getUserTotp } from '../../db/queries/totp';
import { users } from '../../db/schema';
import { decryptTotpSecret } from '../../helpers/totp-crypto';
import { verifySecondFactor } from '../../helpers/verify-second-factor';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import type { Context } from '../../utils/trpc';
import { protectedProcedure } from '../../utils/trpc';

const totpDisableRoute = protectedProcedure
  .input(
    z.object({
      code: z.string().min(6).max(11).optional(),
      password: z.string().min(1).max(128).optional()
    })
  )
  .mutation(async ({ ctx, input }) => {
    // typed alias: tRPC's generic ctx defeats TS's `never`-return
    // narrowing below (row would stay possibly-undefined after the
    // throwValidationError guards), so we re-type it concretely.
    const typedCtx: Context = ctx;
    const row = await getUserTotp(typedCtx.userId);

    if (!row?.totpSecret || row.totpEnabledAt == null) {
      typedCtx.throwValidationError('totp', '2FA is not enabled');
    }

    let reauthenticated = false;

    if (input.code) {
      reauthenticated = await verifySecondFactor(
        typedCtx.userId,
        decryptTotpSecret(row.totpSecret),
        input.code
      );
    }

    if (!reauthenticated && input.password) {
      const user = await db
        .select({ password: users.password })
        .from(users)
        .where(eq(users.id, typedCtx.userId))
        .get();

      invariant(user, { code: 'NOT_FOUND', message: 'User not found' });

      reauthenticated = await Bun.password.verify(
        input.password,
        user.password
      );
    }

    if (!reauthenticated) {
      typedCtx.throwValidationError('code', 'Invalid code or password');
    }

    await disableTotp(typedCtx.userId);

    enqueueActivityLog({
      type: ActivityLogType.USER_DISABLED_2FA,
      userId: typedCtx.userId
    });
  });

export { totpDisableRoute };
