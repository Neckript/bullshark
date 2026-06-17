import { sha256 } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { ownerTokenMatches } from '../use-secret-token';

describe('ownerTokenMatches', () => {
  test('returns true when sha256(input) equals the stored hash', async () => {
    const stored = await sha256('correct-token');
    expect(await ownerTokenMatches('correct-token', stored)).toBe(true);
  });

  test('returns false for a wrong token', async () => {
    const stored = await sha256('correct-token');
    expect(await ownerTokenMatches('wrong-token', stored)).toBe(false);
  });

  test('returns false when stored hash is null', async () => {
    expect(await ownerTokenMatches('anything', null)).toBe(false);
  });
});
