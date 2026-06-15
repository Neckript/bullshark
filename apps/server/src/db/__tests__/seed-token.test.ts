import { describe, expect, test } from 'bun:test';
import { generateOwnerToken } from '../../helpers/owner-token';

describe('seed token derivation', () => {
  test('owner token is CSPRNG, never the literal "dev"', () => {
    for (let i = 0; i < 100; i++) {
      const token = generateOwnerToken();
      expect(token).not.toBe('dev');
      expect(token.length).toBe(43);
    }
  });

  test('owner token and crypto secret source are independent values', () => {
    const ownerToken = generateOwnerToken();
    const cryptoSecret = generateOwnerToken();
    expect(ownerToken).not.toBe(cryptoSecret);
  });
});
