import { beforeEach, describe, expect, it } from 'bun:test';
import * as OTPAuth from 'otpauth';
import { testsBaseUrl } from '../../__tests__/setup';
import { enableTotp, setPendingTotpSecret } from '../../db/mutations/totp';
import { getServerToken } from '../../db/queries/server';
import { generateTotpSecret } from '../../helpers/totp';
import { encryptTotpSecret } from '../../helpers/totp-crypto';

const enable2fa = async (userId: number) => {
  const secret = generateTotpSecret();
  await setPendingTotpSecret(userId, encryptTotpSecret(secret));
  await enableTotp(userId);
  return secret;
};

const startLogin = async () => {
  const res = await fetch(`${testsBaseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'testuser', password: 'password123' })
  });
  const body = (await res.json()) as { challenge: string };
  return body.challenge;
};

describe('POST /login/2fa', () => {
  // Populate the in-memory server token from the seeded test settings
  // before any TOTP crypto/challenge helpers rely on it being cached.
  beforeEach(async () => {
    await getServerToken();
  });

  it('issues a token for a valid code', async () => {
    const secret = await enable2fa(2);
    const challenge = await startLogin();
    const code = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret)
    }).generate();

    const res = await fetch(`${testsBaseUrl}/login/2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge, code })
    });
    const body = (await res.json()) as { token: string };
    expect(res.status).toBe(200);
    expect(typeof body.token).toBe('string');
  });

  it('rejects a wrong code', async () => {
    await enable2fa(2);
    const challenge = await startLogin();
    const res = await fetch(`${testsBaseUrl}/login/2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge, code: '000000' })
    });
    expect(res.status).toBe(400);
  });

  it('rejects a tampered challenge', async () => {
    await enable2fa(2);
    const res = await fetch(`${testsBaseUrl}/login/2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge: '2.9999999999999.deadbeef',
        code: '000000'
      })
    });
    expect(res.status).toBe(400);
  });
});
