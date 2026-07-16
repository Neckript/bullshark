import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';
import { getUserTotp } from '../../db/queries/totp';

describe('security router', () => {
  test('status reports disabled by default', async () => {
    const { caller } = await initTest(2);

    expect(await caller.security.totp.status()).toEqual({
      enabled: false,
      recoveryCodesRemaining: 0
    });
  });

  test('setup returns a uri + secret and stores an encrypted pending secret', async () => {
    const { caller } = await initTest(2);

    const res = await caller.security.totp.setup();

    expect(res.otpauthUri.startsWith('otpauth://totp/')).toBe(true);
    expect(res.secret).toMatch(/^[A-Z2-7]+$/);

    const row = await getUserTotp(2);

    expect(row?.totpSecret).toBeDefined();
    expect(row?.totpSecret).not.toBe(res.secret);
    expect(row?.totpEnabledAt).toBeNull();
  });
});
