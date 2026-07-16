import { describe, expect, test } from 'bun:test';
import * as OTPAuth from 'otpauth';
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

  test('enable rejects a wrong code', async () => {
    const { caller } = await initTest(2);

    await caller.security.totp.setup();

    await expect(
      caller.security.totp.enable({ code: '000000' })
    ).rejects.toThrow();

    expect((await caller.security.totp.status()).enabled).toBe(false);
  });

  test('enable enables with a valid code and returns 10 recovery codes', async () => {
    const { caller } = await initTest(2);

    const { secret } = await caller.security.totp.setup();
    const code = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret)
    }).generate();

    const res = await caller.security.totp.enable({ code });

    expect(res.recoveryCodes).toHaveLength(10);
    expect((await caller.security.totp.status()).enabled).toBe(true);
  });
});
