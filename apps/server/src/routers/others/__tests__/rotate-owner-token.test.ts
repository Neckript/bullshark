import { describe, expect, test } from 'bun:test';
import {
  generateOwnerToken,
  hashOwnerToken
} from '../../../helpers/owner-token';

describe('rotate-owner-token helpers', () => {
  test('generateOwnerToken returns a 43-char base64url string', () => {
    const token = generateOwnerToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(43);
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  test('two calls produce different tokens', () => {
    expect(generateOwnerToken()).not.toBe(generateOwnerToken());
  });

  test('hashOwnerToken returns a non-empty string that differs per token', async () => {
    const t1 = generateOwnerToken();
    const t2 = generateOwnerToken();
    const h1 = await hashOwnerToken(t1);
    const h2 = await hashOwnerToken(t2);
    expect(typeof h1).toBe('string');
    expect(h1.length).toBeGreaterThan(0);
    expect(h1).not.toBe(h2);
  });
});
