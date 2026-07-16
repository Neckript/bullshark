import { markRecoveryCodeUsed } from '../db/mutations/totp';
import { findUnusedRecoveryCode } from '../db/queries/totp';
import { hashRecoveryCode } from './recovery-codes';
import { verifyTotpCode } from './totp';

const verifySecondFactor = async (
  userId: number,
  secretBase32: string,
  code: string
): Promise<boolean> => {
  if (verifyTotpCode(secretBase32, code)) return true;

  const match = await findUnusedRecoveryCode(
    userId,
    await hashRecoveryCode(code)
  );

  if (!match) return false;

  await markRecoveryCodeUsed(match.id);
  return true;
};

export { verifySecondFactor };
