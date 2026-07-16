import {
  countRemainingRecoveryCodes,
  getUserTotp
} from '../../db/queries/totp';
import { protectedProcedure } from '../../utils/trpc';

const totpStatusRoute = protectedProcedure.query(async ({ ctx }) => {
  const row = await getUserTotp(ctx.userId);

  return {
    enabled: row?.totpEnabledAt != null,
    recoveryCodesRemaining: await countRemainingRecoveryCodes(ctx.userId)
  };
});

export { totpStatusRoute };
