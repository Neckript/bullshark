import { z } from 'zod';
import { replaceRecoveryCodes } from '../../db/mutations/totp';
import { getUserTotp } from '../../db/queries/totp';
import {
  generateRecoveryCodes,
  hashRecoveryCode
} from '../../helpers/recovery-codes';
import { verifyTotpCode } from '../../helpers/totp';
import { decryptTotpSecret } from '../../helpers/totp-crypto';
import type { Context } from '../../utils/trpc';
import { protectedProcedure } from '../../utils/trpc';

const totpRegenerateRecoveryCodesRoute = protectedProcedure
  .input(z.object({ code: z.string().min(6).max(6) }))
  .mutation(async ({ ctx, input }) => {
    // typed alias: tRPC's generic ctx defeats TS's `never`-return
    // narrowing below (row would stay possibly-undefined after the
    // throwValidationError guards), so we re-type it concretely.
    const typedCtx: Context = ctx;
    const row = await getUserTotp(typedCtx.userId);

    if (!row?.totpSecret || row.totpEnabledAt == null) {
      typedCtx.throwValidationError('totp', '2FA is not enabled');
    }

    if (!verifyTotpCode(decryptTotpSecret(row.totpSecret), input.code)) {
      typedCtx.throwValidationError('code', 'Invalid code');
    }

    const recoveryCodes = generateRecoveryCodes();
    await replaceRecoveryCodes(
      typedCtx.userId,
      await Promise.all(recoveryCodes.map(hashRecoveryCode))
    );

    return { recoveryCodes };
  });

export { totpRegenerateRecoveryCodesRoute };
