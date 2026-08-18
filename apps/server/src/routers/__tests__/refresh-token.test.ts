import { describe, expect, test } from 'bun:test';
import jwt from 'jsonwebtoken';
import { initTest } from '../../__tests__/helpers';
import { getServerToken } from '../../db/queries/server';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

describe('security.refreshToken', () => {
  test('returns a token that still identifies the same user', async () => {
    const { caller } = await initTest(2);

    const { token } = await caller.security.refreshToken();

    const decoded = jwt.verify(token, await getServerToken()) as {
      userId: number;
    };

    expect(decoded.userId).toBe(2);
  });

  test('extends the expiry to seven days from now', async () => {
    const { caller } = await initTest(2);

    const { token } = await caller.security.refreshToken();

    const decoded = jwt.verify(token, await getServerToken()) as {
      exp: number;
    };
    const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);

    expect(remainingSeconds).toBeGreaterThan(SEVEN_DAYS_SECONDS - 60);
    expect(remainingSeconds).toBeLessThanOrEqual(SEVEN_DAYS_SECONDS);
  });
});
