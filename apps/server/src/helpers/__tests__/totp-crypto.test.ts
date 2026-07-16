import { beforeAll, describe, expect, it } from 'bun:test';
import { getServerToken } from '../../db/queries/server';
import { decryptTotpSecret, encryptTotpSecret } from '../totp-crypto';

describe('totp-crypto', () => {
  // Populate the in-memory server token from the seeded test settings.
  beforeAll(async () => {
    await getServerToken();
  });

  it('round-trips a secret', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.split(':')).toHaveLength(3);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
  });

  it('produces different ciphertext each call (random iv)', () => {
    expect(encryptTotpSecret('SAME')).not.toBe(encryptTotpSecret('SAME'));
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP');
    const [iv, tag, ct] = encrypted.split(':');
    const tampered = `${iv}:${tag}:${Buffer.from('deadbeef').toString('base64')}`;
    void ct;
    expect(() => decryptTotpSecret(tampered)).toThrow();
  });
});
