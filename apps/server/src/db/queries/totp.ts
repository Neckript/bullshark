import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '..';
import { userRecoveryCodes, users } from '../schema';

const getUserTotp = async (userId: number) =>
  db
    .select({
      totpSecret: users.totpSecret,
      totpEnabledAt: users.totpEnabledAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

const countRemainingRecoveryCodes = async (userId: number): Promise<number> => {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(userRecoveryCodes)
    .where(
      and(
        eq(userRecoveryCodes.userId, userId),
        isNull(userRecoveryCodes.usedAt)
      )
    )
    .get();

  return row?.count ?? 0;
};

const findUnusedRecoveryCode = async (userId: number, codeHash: string) =>
  db
    .select({ id: userRecoveryCodes.id })
    .from(userRecoveryCodes)
    .where(
      and(
        eq(userRecoveryCodes.userId, userId),
        eq(userRecoveryCodes.codeHash, codeHash),
        isNull(userRecoveryCodes.usedAt)
      )
    )
    .get();

export { countRemainingRecoveryCodes, findUnusedRecoveryCode, getUserTotp };
