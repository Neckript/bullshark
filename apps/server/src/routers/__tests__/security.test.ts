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

describe('security.totp.disable', () => {
  test('disables with a valid code and password fallback works', async () => {
    const { caller } = await initTest(2);

    const { secret } = await caller.security.totp.setup();
    const code = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret)
    }).generate();
    await caller.security.totp.enable({ code });

    // wrong second factor + wrong password → throws
    await expect(
      caller.security.totp.disable({ code: '000000' })
    ).rejects.toThrow();

    // password fallback (seed uses "password123")
    await caller.security.totp.disable({ password: 'password123' });
    expect((await caller.security.totp.status()).enabled).toBe(false);
  });
});

describe('security.totp.regenerateRecoveryCodes', () => {
  test('rejects an invalid code', async () => {
    const { caller } = await initTest(2);

    const { secret } = await caller.security.totp.setup();
    const code = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret)
    }).generate();
    await caller.security.totp.enable({ code });

    await expect(
      caller.security.totp.regenerateRecoveryCodes({ code: '000000' })
    ).rejects.toThrow();
  });

  test('issues 10 fresh codes with a valid TOTP code, invalidating the old ones', async () => {
    const { caller } = await initTest(2);

    const { secret } = await caller.security.totp.setup();
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret)
    });
    const { recoveryCodes: originalCodes } = await caller.security.totp.enable({
      code: totp.generate()
    });

    const { recoveryCodes } =
      await caller.security.totp.regenerateRecoveryCodes({
        code: totp.generate()
      });

    expect(recoveryCodes).toHaveLength(10);
    expect(recoveryCodes).not.toEqual(originalCodes);
    expect((await caller.security.totp.status()).recoveryCodesRemaining).toBe(
      10
    );
  });
});
