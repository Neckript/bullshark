import { eq } from 'drizzle-orm';
import { db } from '..';
import { userRecoveryCodes, users } from '../schema';

const setPendingTotpSecret = async (
  userId: number,
  encryptedSecret: string
) => {
  await db
    .update(users)
    .set({ totpSecret: encryptedSecret, totpEnabledAt: null })
    .where(eq(users.id, userId))
    .run();
};

const enableTotp = async (userId: number) => {
  await db
    .update(users)
    .set({ totpEnabledAt: Date.now() })
    .where(eq(users.id, userId))
    .run();
};

const disableTotp = async (userId: number) => {
  await db
    .delete(userRecoveryCodes)
    .where(eq(userRecoveryCodes.userId, userId))
    .run();
  await db
    .update(users)
    .set({ totpSecret: null, totpEnabledAt: null })
    .where(eq(users.id, userId))
    .run();
};

const replaceRecoveryCodes = async (userId: number, codeHashes: string[]) => {
  await db
    .delete(userRecoveryCodes)
    .where(eq(userRecoveryCodes.userId, userId))
    .run();

  if (codeHashes.length === 0) return;

  await db
    .insert(userRecoveryCodes)
    .values(
      codeHashes.map((codeHash) => ({
        userId,
        codeHash,
        usedAt: null,
        createdAt: Date.now()
      }))
    )
    .run();
};

const markRecoveryCodeUsed = async (id: number) => {
  await db
    .update(userRecoveryCodes)
    .set({ usedAt: Date.now() })
    .where(eq(userRecoveryCodes.id, id))
    .run();
};

export {
  disableTotp,
  enableTotp,
  markRecoveryCodeUsed,
  replaceRecoveryCodes,
  setPendingTotpSecret
};
