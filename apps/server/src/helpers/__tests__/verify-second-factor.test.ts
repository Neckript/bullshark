import { describe, expect, it } from 'bun:test';
import * as OTPAuth from 'otpauth';
import { replaceRecoveryCodes } from '../../db/mutations/totp';
import { hashRecoveryCode } from '../recovery-codes';
import { verifySecondFactor } from '../verify-second-factor';

const USER_ID = 2;
const SECRET = new OTPAuth.Secret().base32;

describe('verifySecondFactor', () => {
  it('accepts a valid TOTP code', async () => {
    const code = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(SECRET)
    }).generate();
    expect(await verifySecondFactor(USER_ID, SECRET, code)).toBe(true);
  });

  it('accepts a recovery code once, then rejects reuse', async () => {
    await replaceRecoveryCodes(USER_ID, [
      await hashRecoveryCode('ABCDE-FGHIJ')
    ]);
    expect(await verifySecondFactor(USER_ID, SECRET, 'ABCDE-FGHIJ')).toBe(true);
    expect(await verifySecondFactor(USER_ID, SECRET, 'ABCDE-FGHIJ')).toBe(
      false
    );
  });

  it('rejects garbage', async () => {
    expect(await verifySecondFactor(USER_ID, SECRET, '111111')).toBe(false);
  });
});
