import { sha256 } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { generateOwnerToken, hashOwnerToken } from '../owner-token';

describe('owner-token', () => {
  test('generateOwnerToken returns a base64url string of 43 chars (32 bytes)', () => {
    const token = generateOwnerToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('generateOwnerToken is never the literal "dev"', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateOwnerToken()).not.toBe('dev');
    }
  });

  test('generateOwnerToken is unique across calls', () => {
    expect(generateOwnerToken()).not.toBe(generateOwnerToken());
  });

  test('hashOwnerToken equals sha256 of the token', async () => {
    const token = 'sample-token';
    expect(await hashOwnerToken(token)).toBe(await sha256(token));
  });
});
