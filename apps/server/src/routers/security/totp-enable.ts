import { ActivityLogType } from '@sharkord/shared';
import { z } from 'zod';
import { enableTotp, replaceRecoveryCodes } from '../../db/mutations/totp';
import { getUserTotp } from '../../db/queries/totp';
import {
  generateRecoveryCodes,
  hashRecoveryCode
} from '../../helpers/recovery-codes';
import { verifyTotpCode } from '../../helpers/totp';
import { decryptTotpSecret } from '../../helpers/totp-crypto';
import { enqueueActivityLog } from '../../queues/activity-log';
import type { Context } from '../../utils/trpc';
import { protectedProcedure } from '../../utils/trpc';

const totpEnableRoute = protectedProcedure
  .input(z.object({ code: z.string().min(6).max(10) }))
  .mutation(async ({ ctx, input }) => {
    // typed alias: tRPC's generic ctx defeats TS's `never`-return
    // narrowing below (row would stay possibly-undefined after the
    // throwValidationError guards), so we re-type it concretely.
    const typedCtx: Context = ctx;
    const row = await getUserTotp(typedCtx.userId);

    if (!row || !row.totpSecret) {
      typedCtx.throwValidationError('totp', 'Start 2FA setup first');
    }

    if (row.totpEnabledAt != null) {
      typedCtx.throwValidationError('totp', '2FA is already enabled');
    }

    const secret = decryptTotpSecret(row.totpSecret);

    if (!verifyTotpCode(secret, input.code)) {
      typedCtx.throwValidationError('code', 'Invalid code');
    }

    const recoveryCodes = generateRecoveryCodes();
    const hashes = await Promise.all(recoveryCodes.map(hashRecoveryCode));

    await enableTotp(typedCtx.userId);
    await replaceRecoveryCodes(typedCtx.userId, hashes);

    enqueueActivityLog({
      type: ActivityLogType.USER_ENABLED_2FA,
      userId: typedCtx.userId
    });

    return { recoveryCodes };
  });

export { totpEnableRoute };
