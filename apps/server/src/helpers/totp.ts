import * as OTPAuth from 'otpauth';

const buildTotp = (secretBase32: string): OTPAuth.TOTP =>
  new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32)
  });

const generateTotpSecret = (): string => new OTPAuth.Secret().base32;

const buildOtpauthUri = (
  secretBase32: string,
  accountLabel: string,
  issuer: string
): string =>
  new OTPAuth.TOTP({
    issuer,
    label: accountLabel,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32)
  }).toString();

const verifyTotpCode = (secretBase32: string, code: string): boolean => {
  const normalized = code.replace(/\s/g, '');

  if (!/^\d{6}$/.test(normalized)) return false;

  return (
    buildTotp(secretBase32).validate({ token: normalized, window: 1 }) !== null
  );
};

export { buildOtpauthUri, generateTotpSecret, verifyTotpCode };
