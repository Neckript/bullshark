import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../..';
import { initTest } from '../../../__tests__/helpers';
import { users } from '../../schema';
import { getServerToken } from '../server';
import { getUserByToken } from '../users';

const tokenFor = async (userId: number, tokenVersion?: number) =>
  jwt.sign(
    tokenVersion === undefined ? { userId } : { userId, tokenVersion },
    await getServerToken(),
    { algorithm: 'HS256' }
  );

const versionOf = async (userId: number) =>
  (
    await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, userId))
      .get()
  )?.tokenVersion;

// There is no server-side logout, so tokenVersion is the only thing that can
// revoke a token before its 7 day expiry. These tests cover the three states
// getUserByToken has to tell apart, plus the one route that bumps it.
describe('token revocation', () => {
  test('accepts a token whose version matches the user', async () => {
    const token = await tokenFor(1, await versionOf(1));

    expect((await getUserByToken(token))?.id).toBe(1);
  });

  test('rejects a token whose version is stale', async () => {
    const current = (await versionOf(1))!;
    const token = await tokenFor(1, current);

    await db
      .update(users)
      .set({ tokenVersion: current + 1 })
      .where(eq(users.id, 1))
      .run();

    expect(await getUserByToken(token)).toBeUndefined();
  });

  test('rejects a token whose version is ahead of the user', async () => {
    const token = await tokenFor(1, (await versionOf(1))! + 1);

    expect(await getUserByToken(token)).toBeUndefined();
  });

  // Every token minted before this feature existed has no tokenVersion claim,
  // and the migration backfilled every row to 0. If this one fails, deploying
  // logs out every user on the server at once.
  test('still accepts a token with no version claim at all', async () => {
    const token = await tokenFor(1);

    expect((await getUserByToken(token))?.id).toBe(1);
  });

  test('banning a user revokes the tokens they already hold', async () => {
    const token = await tokenFor(2, await versionOf(2));

    expect((await getUserByToken(token))?.id).toBe(2);

    const { caller } = await initTest(1);

    await caller.users.ban({ userId: 2, reason: 'test' });

    expect(await getUserByToken(token)).toBeUndefined();
  });

  test('changing the password revokes tokens issued before it', async () => {
    const token = await tokenFor(1, await versionOf(1));

    expect((await getUserByToken(token))?.id).toBe(1);

    const { caller } = await initTest(1);

    await caller.users.updatePassword({
      currentPassword: 'password123',
      newPassword: 'newpassword123',
      confirmNewPassword: 'newpassword123'
    });

    expect(await getUserByToken(token)).toBeUndefined();
  });
});
