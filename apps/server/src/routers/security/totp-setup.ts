import { setPendingTotpSecret } from '../../db/mutations/totp';
import { getSettings } from '../../db/queries/server';
import { getUserTotp } from '../../db/queries/totp';
import { buildOtpauthUri, generateTotpSecret } from '../../helpers/totp';
import { encryptTotpSecret } from '../../helpers/totp-crypto';
import { protectedProcedure } from '../../utils/trpc';

const totpSetupRoute = protectedProcedure.mutation(async ({ ctx }) => {
  const existing = await getUserTotp(ctx.userId);

  if (existing?.totpEnabledAt != null) {
    ctx.throwValidationError('totp', '2FA is already enabled');
  }

  const secret = generateTotpSecret();
  await setPendingTotpSecret(ctx.userId, encryptTotpSecret(secret));

  const settings = await getSettings();
  const otpauthUri = buildOtpauthUri(secret, ctx.user.identity, settings.name);

  return { otpauthUri, secret };
});

export { totpSetupRoute };
