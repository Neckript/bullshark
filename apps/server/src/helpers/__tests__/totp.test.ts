import { describe, expect, it } from 'bun:test';
import * as OTPAuth from 'otpauth';
import { buildOtpauthUri, generateTotpSecret, verifyTotpCode } from '../totp';

describe('totp helper', () => {
  it('generates a usable base32 secret', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it('builds an otpauth:// uri carrying issuer and label', () => {
    const uri = buildOtpauthUri('JBSWY3DPEHPK3PXP', 'alice', 'Bullshark');
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('issuer=Bullshark');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
  });

  it('accepts a freshly generated code and rejects a wrong one', () => {
    const secret = generateTotpSecret();
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret)
    });
    expect(verifyTotpCode(secret, totp.generate())).toBe(true);
    expect(verifyTotpCode(secret, '000000')).toBe(false);
  });
});
