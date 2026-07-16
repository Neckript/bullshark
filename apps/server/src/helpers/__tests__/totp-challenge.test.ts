import { beforeAll, describe, expect, it } from 'bun:test';
import { getServerToken } from '../../db/queries/server';
import { createTotpChallenge, resolveTotpChallenge } from '../totp-challenge';

describe('totp-challenge', () => {
  beforeAll(async () => {
    await getServerToken();
  });

  it('round-trips a valid challenge to the userId', () => {
    const challenge = createTotpChallenge(42);
    expect(resolveTotpChallenge(challenge)).toBe(42);
  });

  it('rejects an expired challenge', () => {
    const challenge = createTotpChallenge(42, -1000);
    expect(resolveTotpChallenge(challenge)).toBeNull();
  });

  it('rejects a tampered challenge', () => {
    const challenge = createTotpChallenge(42);
    const [, expiresAt, hmac] = challenge.split('.');
    expect(resolveTotpChallenge(`99.${expiresAt}.${hmac}`)).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(resolveTotpChallenge('garbage')).toBeNull();
  });
});
